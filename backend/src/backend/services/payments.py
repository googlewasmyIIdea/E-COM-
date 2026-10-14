"""Official eSewa ePay v2 / Khalti ePayment adapters. No simulated success."""

import base64
import hashlib
import hmac
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID

import httpx
from pydantic import JsonValue, TypeAdapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import Settings
from backend.core.exception import ConflictError, ServiceUnavailableError
from backend.models.commerce import Notification, OrderItem, Payment
from backend.schemas.auth import UserResponse
from backend.schemas.commerce import PaymentInitiation, PaymentResult
from backend.services.common import require_found
from backend.services.inventory import InventoryService
from backend.services.orders import OrderService


class PaymentService:
    def __init__(
        self, db: AsyncSession, settings: Settings, http: httpx.AsyncClient
    ) -> None:
        self.db = db
        self.settings = settings
        self.http = http

    def credentials(self, provider: str) -> None:
        if provider == "khalti" and not self.settings.khalti_secret_key:
            raise ServiceUnavailableError(
                "Khalti is not configured. Choose Cash on Delivery."
            )
        if provider == "esewa" and not (
            self.settings.esewa_secret_key and self.settings.esewa_product_code
        ):
            raise ServiceUnavailableError(
                "eSewa is not configured. Choose Cash on Delivery."
            )

    @property
    def khalti_url(self) -> str:
        return (
            "https://khalti.com/api/v2"
            if self.settings.payment_environment == "production"
            else "https://dev.khalti.com/api/v2"
        )

    async def initiate(
        self, identifier: UUID, actor: UserResponse
    ) -> PaymentInitiation:
        order = await OrderService(self.db).owned(identifier, actor, lock=True)
        if order.payment_method == "cod":
            raise ConflictError("Cash on Delivery does not need an online payment.")
        self.credentials(order.payment_method)
        if order.payment_status == "paid" or order.status == "cancelled":
            raise ConflictError("This order cannot accept a new payment.")
        payment = require_found(
            await self.db.scalar(
                select(Payment).where(Payment.order_id == order.id).with_for_update()
            ),
            "Payment",
        )
        callback = f"{self.settings.app_origin}/payment/return?order={order.id}&provider={order.payment_method}"
        if order.payment_method == "khalti":
            saved_url = payment.response.get("payment_url")
            if payment.reference and isinstance(saved_url, str):
                return PaymentInitiation(
                    provider="khalti",
                    payment_url=saved_url,
                    reference=payment.reference,
                )
            try:
                response = await self.http.post(
                    f"{self.khalti_url}/epayment/initiate/",
                    headers={"Authorization": f"Key {self.settings.khalti_secret_key}"},
                    json={
                        "return_url": callback,
                        "website_url": self.settings.app_origin,
                        "amount": int(order.total * 100),
                        "purchase_order_id": str(order.id),
                        "purchase_order_name": order.number,
                        "customer_info": {
                            "name": actor.name or "Customer",
                            "email": actor.email,
                        },
                    },
                )
                response.raise_for_status()
                data: dict[str, JsonValue] = TypeAdapter(
                    dict[str, JsonValue]
                ).validate_python(response.json())
                reference, payment_url = data.get("pidx"), data.get("payment_url")
                if (
                    not isinstance(reference, str)
                    or not isinstance(payment_url, str)
                    or not payment_url.startswith("https://")
                ):
                    raise ServiceUnavailableError(
                        "Unexpected payment provider response."
                    )
            except (httpx.HTTPError, ValueError) as exc:
                raise ServiceUnavailableError(
                    "Unable to initiate payment. Please retry."
                ) from exc
            payment.reference = reference
            payment.response = {"payment_url": payment_url}
            payment.status = "pending"
            await self.db.commit()
            return PaymentInitiation(
                provider="khalti", payment_url=payment_url, reference=reference
            )
        reference = payment.reference or str(payment.id)
        total = format(order.total, ".2f")
        fields = {
            "amount": total,
            "tax_amount": "0",
            "total_amount": total,
            "transaction_uuid": reference,
            "product_code": self.settings.esewa_product_code,
            "product_service_charge": "0",
            "product_delivery_charge": "0",
            "success_url": callback,
            "failure_url": callback,
            "signed_field_names": "total_amount,transaction_uuid,product_code",
        }
        signed = f"total_amount={total},transaction_uuid={reference},product_code={self.settings.esewa_product_code}"
        fields["signature"] = base64.b64encode(
            hmac.new(
                self.settings.esewa_secret_key.encode(), signed.encode(), hashlib.sha256
            ).digest()
        ).decode()
        payment.reference = reference
        payment.status = "pending"
        await self.db.commit()
        form_url = (
            "https://epay.esewa.com.np/api/epay/main/v2/form"
            if self.settings.payment_environment == "production"
            else "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
        )
        return PaymentInitiation(
            provider="esewa", form_url=form_url, fields=fields, reference=reference
        )

    async def verify(
        self, identifier: UUID, reference: str, actor: UserResponse
    ) -> PaymentResult:
        order = await OrderService(self.db).owned(identifier, actor)
        self.credentials(order.payment_method)
        payment = require_found(
            await self.db.scalar(select(Payment).where(Payment.order_id == order.id)),
            "Payment",
        )
        if payment.reference != reference:
            raise ConflictError("Payment reference does not match this order.")
        if payment.status == "paid":
            return PaymentResult(order_id=order.id, status="paid", verified=True)
        try:
            if order.payment_method == "khalti":
                response = await self.http.post(
                    f"{self.khalti_url}/epayment/lookup/",
                    headers={"Authorization": f"Key {self.settings.khalti_secret_key}"},
                    json={"pidx": reference},
                )
            elif order.payment_method == "esewa":
                host = (
                    "https://epay.esewa.com.np"
                    if self.settings.payment_environment == "production"
                    else "https://uat.esewa.com.np"
                )
                response = await self.http.get(
                    f"{host}/api/epay/transaction/status/",
                    params={
                        "product_code": self.settings.esewa_product_code,
                        "total_amount": format(order.total, ".2f"),
                        "transaction_uuid": reference,
                    },
                )
            else:
                raise ConflictError("This order does not use an online payment.")
            response.raise_for_status()
            data = TypeAdapter(dict[str, JsonValue]).validate_python(response.json())
            provider_status = data.get("status")
            raw_amount = (
                data.get("total_amount")
                if order.payment_method == "khalti"
                else data.get("totalAmount")
            )
            amount = Decimal(str(raw_amount)) / (
                100 if order.payment_method == "khalti" else 1
            )
        except (httpx.HTTPError, ValueError, InvalidOperation) as exc:
            raise ServiceUnavailableError(
                "Unable to verify payment with the provider. Please retry."
            ) from exc
        matched_reference = (
            data.get("pidx") if order.payment_method == "khalti" else data.get("pid")
        )
        if amount != order.total or matched_reference != reference:
            raise ConflictError(
                "Payment amount or provider reference does not match this order."
            )
        complete = provider_status == (
            "Completed" if order.payment_method == "khalti" else "COMPLETE"
        )
        if not complete:
            return PaymentResult(
                order_id=order.id,
                status=str(provider_status or "pending"),
                verified=False,
            )
        transaction = (
            data.get("transaction_id")
            if order.payment_method == "khalti"
            else data.get("refId")
        )
        if not isinstance(transaction, str) or not transaction:
            raise ConflictError(
                "Provider did not return a valid transaction identifier."
            )
        await InventoryService(self.db).lock()
        await self.db.refresh(payment)
        await self.db.refresh(order)
        other = await self.db.scalar(
            select(Payment.id).where(
                Payment.id != payment.id,
                Payment.provider == order.payment_method,
                Payment.response["transaction_id"].as_string() == transaction,
            )
        )
        if other:
            raise ConflictError(
                "This provider transaction was already recorded for another order."
            )
        payment.status = "paid"
        payment.verified_at = datetime.now(UTC)
        payment.response = {
            "transaction_id": transaction,
            "provider_status": str(provider_status),
        }
        order.payment_status = "paid"
        if order.status == "pending_payment":
            lines = (
                await self.db.scalars(
                    select(OrderItem).where(OrderItem.order_id == order.id)
                )
            ).all()
            if not all(line.allocated == line.quantity for line in lines):
                order.status = "awaiting_stock"
            else:
                order.status = (
                    "processing"
                    if await OrderService(self.db).release_ready(order)
                    else "awaiting_release"
                )
        self.db.add(
            Notification(
                user_id=actor.id,
                recipient=actor.email,
                subject=f"Payment confirmed: {order.number}",
                body=f"Your NPR {order.total} payment was verified with {order.payment_method}.",
            )
        )
        await self.db.commit()
        return PaymentResult(order_id=order.id, status="paid", verified=True)
