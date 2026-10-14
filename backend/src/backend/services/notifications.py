import json
from email.message import EmailMessage
from html import escape
from pathlib import Path

import aiosmtplib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.core.config import Settings
from backend.models.commerce import Notification


class NotificationService:
    def __init__(self, db: AsyncSession, settings: Settings) -> None:
        self.db = db
        self.settings = settings

    async def deliver_pending(self) -> None:
        messages = (
            await self.db.scalars(
                select(Notification)
                .where(Notification.status == "queued", Notification.attempts < 5)
                .with_for_update(skip_locked=True)
                .limit(20)
            )
        ).all()
        for notification in messages:
            notification.attempts += 1
            message = EmailMessage()
            message["From"] = self.settings.email_from
            message["To"] = notification.recipient
            message["Subject"] = notification.subject
            message.set_content(notification.body)
            message.add_alternative(
                '<html><body style="background:#FAF8F3;padding:32px;font-family:Arial;color:#25223B"><h1>Paper &amp; Petal</h1><h2>'
                + escape(notification.subject)
                + '</h2><p style="white-space:pre-line">'
                + escape(notification.body)
                + "</p><p>Thoughtful stationery. Brighter everyday.</p></body></html>",
                subtype="html",
            )
            try:
                if self.settings.smtp_host:
                    await aiosmtplib.send(
                        message,
                        hostname=self.settings.smtp_host,
                        port=self.settings.smtp_port,
                        username=self.settings.smtp_username or None,
                        password=self.settings.smtp_password or None,
                        start_tls=self.settings.smtp_starttls,
                        timeout=15,
                    )
                    notification.status = "sent"
                else:
                    await run_in_threadpool(self._local_delivery, notification)
                    notification.status = "local"
                notification.error = None
            except (OSError, aiosmtplib.errors.SMTPException):
                if notification.attempts >= 5:
                    notification.status = "failed"
                    notification.error = "Email delivery failed after five attempts."
                else:
                    notification.error = "Email delivery failed; retry scheduled."
        await self.db.commit()

    def _local_delivery(self, notification: Notification) -> None:
        folder = Path(self.settings.mail_dir)
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        path = folder / f"{notification.id}.json"
        path.write_text(
            json.dumps(
                {
                    "to": notification.recipient,
                    "subject": notification.subject,
                    "body": notification.body,
                },
                indent=2,
            )
        )
        path.chmod(0o600)
