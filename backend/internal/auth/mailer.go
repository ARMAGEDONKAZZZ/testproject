package auth

import (
	"fmt"
	"log/slog"
	"net/smtp"

	"github.com/neuratop/backend/internal/platform/config"
)

// Mailer sends one-time codes by email. When SMTP_HOST is not configured
// (the default for local development, matching quickstart.md's suggestion
// to use a local catch-all like Mailpit), it logs the code instead of
// failing, so registration/login/reset remain testable without a real mail
// server.
type Mailer struct {
	cfg config.Config
}

func NewMailer(cfg config.Config) Mailer {
	return Mailer{cfg: cfg}
}

func (m Mailer) SendCode(to, purpose, code string) error {
	subject, body := codeEmailContent(purpose, code)

	if m.cfg.SMTPHost == "" {
		slog.Warn("SMTP not configured; logging verification code instead of sending email",
			"to", to, "purpose", purpose, "code", code)
		return nil
	}

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n", m.cfg.SMTPFrom, to, subject, body)
	addr := m.cfg.SMTPHost + ":" + m.cfg.SMTPPort
	var auth smtp.Auth
	if m.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPassword, m.cfg.SMTPHost)
	}
	return smtp.SendMail(addr, auth, m.cfg.SMTPFrom, []string{to}, []byte(msg))
}

func codeEmailContent(purpose, code string) (subject, body string) {
	switch purpose {
	case "registration":
		return "Код подтверждения Neuratop", fmt.Sprintf("Ваш код подтверждения: %s", code)
	case "password_reset":
		return "Восстановление пароля Neuratop", fmt.Sprintf("Код для сброса пароля: %s", code)
	default:
		return "Код Neuratop", fmt.Sprintf("Ваш код: %s", code)
	}
}
