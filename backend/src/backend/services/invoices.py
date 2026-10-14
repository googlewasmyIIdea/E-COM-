from html import escape
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.schemas.auth import UserResponse
from backend.schemas.commerce import Schema
from backend.services.orders import OrderService


class InvoiceDocument(Schema):
    html: str
    filename: str


class InvoiceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def render(self, identifier: UUID, actor: UserResponse) -> InvoiceDocument:
        service = OrderService(self.db)
        order = await service.view(await service.owned(identifier, actor))
        lines = "".join(
            f"<tr><td>{escape(item.product_name)} — {escape(item.variant_name)}</td><td>{item.quantity}</td><td>NPR {item.unit_price}</td><td>NPR {item.total}</td></tr>"
            for item in order.items
        )
        address = "<br>".join(
            escape(str(order.address.get(key, "")))
            for key in ["name", "line1", "line2", "city", "phone"]
        )
        html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice {order.number}</title><style>body{{font:16px Arial;margin:48px;color:#25223b}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;border-bottom:1px solid #ddd;text-align:left}}@media print{{body{{margin:12px}}}}</style></head><body><h1>Paper &amp; Petal</h1><h2>Invoice {order.number}</h2><p>{address}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead><tbody>{lines}</tbody></table><p>Subtotal: NPR {order.subtotal}<br>Discount: NPR {order.discount}<br>Shipping: NPR {order.shipping}</p><h3>Total: NPR {order.total}</h3><p>Payment: {escape(order.payment_method)} / {escape(order.payment_status)}</p></body></html>'
        return InvoiceDocument(html=html, filename=f"invoice-{order.number}.html")
