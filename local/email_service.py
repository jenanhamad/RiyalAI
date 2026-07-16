"""Optional SMTP email — password reset."""
import os
import smtplib
from email.message import EmailMessage


def smtp_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST", "").strip()
        and os.environ.get("SMTP_FROM", "").strip()
    )


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Send Arabic password-reset email. Raises if SMTP fails."""
    host = os.environ.get("SMTP_HOST", "").strip()
    from_addr = os.environ.get("SMTP_FROM", "").strip()
    if not host or not from_addr:
        raise RuntimeError("SMTP not configured")

    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "1").strip() not in ("0", "false", "False")

    msg = EmailMessage()
    msg["Subject"] = "استعادة كلمة مرور ريالي"
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(
        f"مرحباً،\n\n"
        f"طلبت استعادة كلمة المرور لتطبيق ريالي.\n"
        f"افتح الرابط التالي (صالح لمدة ساعة):\n\n{reset_url}\n\n"
        f"إذا لم تطلب هذا، تجاهل الرسالة.\n\n— ريالي"
    )

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)
