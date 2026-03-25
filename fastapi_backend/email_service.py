import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
except Exception:  # pragma: no cover
    SendGridAPIClient = None
    Mail = None

try:
    import boto3
except Exception:  # pragma: no cover
    boto3 = None

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent


def is_email_configuration_error(detail: str | None) -> bool:
    if not detail:
        return True
    normalized = detail.lower()
    config_markers = (
        "not configured",
        "credentials are missing",
        "package missing",
        "recipient email is empty",
    )
    return any(marker in normalized for marker in config_markers)


@dataclass
class EmailSettings:
    provider: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_from_email: str
    smtp_use_tls: bool
    sendgrid_api_key: str
    sendgrid_from_email: str
    aws_region: str
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_ses_from_email: str


def _load_email_settings() -> EmailSettings:
    # reload every call so user can update .env without process restart
    load_dotenv(BASE_DIR / ".env", override=True)

    smtp_user = (
        os.getenv("SMTP_USER", "").strip()
        or os.getenv("EMAIL_USER", "").strip()
        or os.getenv("EMAIL_ADDRESS", "").strip()
    )
    smtp_password = (
        os.getenv("SMTP_PASSWORD", "").strip()
        or os.getenv("SMTP_APP_PASSWORD", "").strip()
        or os.getenv("EMAIL_PASSWORD", "").strip()
        or os.getenv("APP_PASSWORD", "").strip()
    )
    smtp_from_raw = (
        os.getenv("SMTP_FROM_EMAIL", "").strip()
        or os.getenv("EMAIL_FROM", "").strip()
    )
    if not smtp_user and smtp_from_raw:
        smtp_user = smtp_from_raw
    smtp_from = smtp_from_raw or smtp_user or "no-reply@smart-ecommerce.local"
    provider = os.getenv("EMAIL_PROVIDER", "smtp").strip().lower() or "smtp"
    smtp_host = os.getenv("SMTP_HOST", "").strip()

    return EmailSettings(
        provider=provider,
        smtp_host=smtp_host,
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        smtp_from_email=smtp_from,
        smtp_use_tls=os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        sendgrid_api_key=os.getenv("SENDGRID_API_KEY", "").strip(),
        sendgrid_from_email=(os.getenv("SENDGRID_FROM_EMAIL", "").strip() or smtp_from),
        aws_region=(os.getenv("AWS_REGION", "ap-south-1").strip() or "ap-south-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "").strip(),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "").strip(),
        aws_ses_from_email=(os.getenv("AWS_SES_FROM_EMAIL", "").strip() or smtp_from),
    )


def _send_via_smtp(
    settings: EmailSettings,
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> tuple[bool, str]:
    if not settings.smtp_host:
        return False, "SMTP_HOST is not configured"
    if not settings.smtp_user:
        return False, "SMTP_USER is not configured"
    if not settings.smtp_password:
        return False, "SMTP_PASSWORD is not configured"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        use_ssl = int(settings.smtp_port) == 465
        smtp_cls = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_cls(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            if settings.smtp_use_tls and not use_ssl:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True, "SMTP email sent"
    except Exception as exc:
        logger.exception("SMTP email send failed: %s", exc)
        return False, f"SMTP send failed: {exc}"


def _send_via_sendgrid(
    settings: EmailSettings,
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> tuple[bool, str]:
    if not settings.sendgrid_api_key or SendGridAPIClient is None or Mail is None:
        return False, "SendGrid not configured or package missing"
    try:
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=to_email,
            subject=subject,
            plain_text_content=body,
            html_content=html_body or body,
        )
        client = SendGridAPIClient(settings.sendgrid_api_key)
        response = client.send(message)
        ok = 200 <= int(getattr(response, "status_code", 500)) < 300
        if ok:
            return True, "SendGrid email sent"
        return False, f"SendGrid returned status {getattr(response, 'status_code', 'unknown')}"
    except Exception as exc:
        logger.exception("SendGrid email send failed: %s", exc)
        return False, f"SendGrid send failed: {exc}"


def _send_via_ses(
    settings: EmailSettings,
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> tuple[bool, str]:
    if boto3 is None:
        return False, "boto3 is not installed"
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        return False, "AWS SES credentials are missing"

    try:
        ses_client = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        response = ses_client.send_email(
            Source=settings.aws_ses_from_email,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {
                    "Text": {"Data": body},
                    "Html": {"Data": html_body or body},
                },
            },
        )
        if response.get("MessageId"):
            return True, f"AWS SES email sent (MessageId: {response.get('MessageId')})"
        return False, "AWS SES did not return MessageId"
    except Exception as exc:
        logger.exception("AWS SES email send failed: %s", exc)
        return False, f"AWS SES send failed: {exc}"


def send_email_notification(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> bool:
    success, _ = send_email_notification_with_result(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )
    return success


def send_email_notification_with_result(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> tuple[bool, str]:
    if not to_email:
        return False, "Recipient email is empty"

    settings = _load_email_settings()

    if settings.provider == "sendgrid":
        ok, detail = _send_via_sendgrid(settings, to_email, subject, body, html_body)
        if ok:
            return ok, detail
        smtp_ok, smtp_detail = _send_via_smtp(settings, to_email, subject, body, html_body)
        return smtp_ok, f"{detail} | fallback: {smtp_detail}"

    if settings.provider == "ses":
        ok, detail = _send_via_ses(settings, to_email, subject, body, html_body)
        if ok:
            return ok, detail
        smtp_ok, smtp_detail = _send_via_smtp(settings, to_email, subject, body, html_body)
        return smtp_ok, f"{detail} | fallback: {smtp_detail}"

    return _send_via_smtp(settings, to_email, subject, body, html_body)
