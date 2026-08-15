import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthSplitLayout } from "./components/AuthSplitLayout";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import { usePasswordResetStart, usePasswordResetComplete } from "@/features/auth/hooks";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = usePasswordResetStart();
  const complete = usePasswordResetComplete();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleRequestCode() {
    if (!email) {
      toast.error("Введите email");
      return;
    }
    try {
      await start.mutateAsync(email);
      setStep("reset");
      toast.success(t("auth.codeSentBanner"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  async function handleReset() {
    if (!code || newPassword.length < 8) {
      toast.error("Введите код и новый пароль (минимум 8 символов)");
      return;
    }
    try {
      await complete.mutateAsync({ email, code, newPassword });
      toast.success("Пароль изменён, теперь можно войти");
      navigate("/auth/login", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Неверный или истёкший код");
    }
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-text-primary">{t("auth.forgotPasswordTitle")}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t("auth.forgotPasswordSubtitle")}</p>

      {step === "email" ? (
        <div className="mt-6 space-y-4">
          <Input
            label={t("auth.emailLabel")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button className="w-full" loading={start.isPending} onClick={() => void handleRequestCode()}>
            {t("auth.getCode")}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <Input label={t("auth.emailLabel")} value={email} disabled />
          <Input label="Код" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          <Input
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button className="w-full" loading={complete.isPending} onClick={() => void handleReset()}>
            {t("common.saveChanges")}
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-text-secondary">
        <Link to="/auth/login" className="text-accent-green">
          {t("auth.login")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
