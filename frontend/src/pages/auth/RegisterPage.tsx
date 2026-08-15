import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthSplitLayout } from "./components/AuthSplitLayout";
import { AgeGateStep, deriveAgeTier, type AgeTier } from "./components/AgeGateStep";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { toast } from "@/components/Toast";
import { ApiError } from "@/api/client";
import {
  useRegisterStart,
  useRegisterCode,
  useRegisterVerify,
  useRegisterNickname,
} from "@/features/auth/hooks";

type Step = "age" | "consent" | "email" | "code" | "nickname";

const NICKNAME_SUGGESTIONS = [
  "ChessKnight",
  "PuzzleMaster",
  "PawnKing",
  "BraveRook",
  "ChessNinja",
  "LittleBishop",
  "QueenMaster",
];

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("age");
  const [age, setAge] = useState<number | null>(null);
  const [ageTier, setAgeTier] = useState<AgeTier | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [nickname, setNickname] = useState("");

  const registerStart = useRegisterStart();
  const registerCode = useRegisterCode();
  const registerVerify = useRegisterVerify();
  const registerNickname = useRegisterNickname();

  function handleAgeContinue(tier: AgeTier, ageValue: number) {
    setAgeTier(tier);
    setAge(ageValue);
    setStep(tier === "adult" ? "email" : "consent");
  }

  async function handleConsentSubmit() {
    if (!consentChecked || !parentName || !parentEmail || age === null) {
      toast.error("Заполните имя и email родителя и подтвердите согласие");
      return;
    }
    try {
      const res = await registerStart.mutateAsync({
        age,
        parent: { name: parentName, email: parentEmail },
      });
      setRegistrationId(res.registrationId);
      setStep("code");
      await registerCode.mutateAsync(res.registrationId);
      setCodeSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  async function handleEmailContinue() {
    if (!email || age === null) {
      toast.error("Введите email");
      return;
    }
    try {
      const res = await registerStart.mutateAsync({ age, email });
      setRegistrationId(res.registrationId);
      setStep("code");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  async function handleGetCode() {
    if (!registrationId) return;
    try {
      await registerCode.mutateAsync(registrationId);
      setCodeSent(true);
      toast.success(t("auth.codeSentBanner"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  async function handleVerify() {
    if (!registrationId || !code) return;
    try {
      await registerVerify.mutateAsync({
        registrationId,
        code,
        password: ageTier === "adult" ? password : undefined,
      });
      setStep("nickname");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Неверный или истёкший код");
    }
  }

  async function handleFinish(chosenNickname: string) {
    if (!chosenNickname || chosenNickname.length < 3) {
      toast.error("Никнейм должен быть от 3 символов");
      return;
    }
    try {
      await registerNickname.mutateAsync(chosenNickname);
      navigate("/generate", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  }

  function handleOAuthClick(provider: "google" | "apple") {
    toast.error(`Вход через ${provider === "google" ? "Google" : "Apple"} пока не подключён`);
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-text-primary">{t("auth.registerTitle")}</h1>
      <p className="mt-1 text-sm text-text-secondary">{t("auth.registerSubtitle")}</p>

      {step === "age" && (
        <div className="mt-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">{t("auth.ageLabel")}</p>
          <AgeGateStepWithAge onContinue={handleAgeContinue} />
        </div>
      )}

      {step === "consent" && (
        <div className="mt-6 space-y-4">
          <Input
            label={t("auth.parentNameLabel")}
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
          <Input
            label={t("auth.parentEmailLabel")}
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
          />
          <label className="flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-1"
            />
            {t("auth.parentConsent")}
          </label>
          <Button
            className="w-full"
            loading={registerStart.isPending}
            onClick={() => void handleConsentSubmit()}
          >
            {t("common.next")}
          </Button>
        </div>
      )}

      {step === "email" && (
        <div className="mt-6 space-y-4">
          <Input
            label={t("auth.emailLabel")}
            type="email"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="h-px flex-1 bg-border-subtle" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border-subtle" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => handleOAuthClick("google")}>
              Google
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => handleOAuthClick("apple")}>
              Apple
            </Button>
          </div>
          <Button className="w-full" loading={registerStart.isPending} onClick={() => void handleEmailContinue()}>
            {t("common.next")}
          </Button>
          <p className="text-xs text-text-muted">{t("auth.termsAgreement")}</p>
        </div>
      )}

      {step === "code" && (
        <div className="mt-6 space-y-4">
          {codeSent && (
            <div className="rounded-xl bg-bg-elevated px-4 py-2 text-center text-sm text-text-secondary">
              {t("auth.codeSentBanner")}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Input
              label="Код"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="flex-1"
            />
            <Button variant="secondary" onClick={() => void handleGetCode()} loading={registerCode.isPending}>
              {t("auth.getCode")}
            </Button>
          </div>
          {ageTier === "adult" && (
            <Input
              label={t("auth.passwordLabel")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <Button className="w-full" loading={registerVerify.isPending} onClick={() => void handleVerify()}>
            {t("auth.register")}
          </Button>
        </div>
      )}

      {step === "nickname" && (
        <div className="mt-6 space-y-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">{t("auth.nicknameLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {NICKNAME_SUGGESTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNickname(n)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm " +
                  (nickname === n
                    ? "border-accent-green text-accent-green"
                    : "border-border-subtle text-text-secondary")
                }
              >
                {n}
              </button>
            ))}
          </div>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Свой никнейм" />
          <p className="text-xs text-text-muted">{t("auth.nicknameHint")}</p>
          <Button className="w-full" loading={registerNickname.isPending} onClick={() => void handleFinish(nickname)}>
            {t("auth.register")}
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-text-secondary">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link to="/auth/login" className="text-accent-green">
          {t("auth.login")}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

/** Wraps AgeGateStep with a required numeric age input before continuing. */
function AgeGateStepWithAge({
  onContinue,
}: {
  onContinue: (tier: AgeTier, age: number) => void;
}) {
  const { t } = useTranslation();
  const [tier, setTier] = useState<AgeTier | null>(null);
  const [ageInput, setAgeInput] = useState("");

  return (
    <div className="space-y-4">
      <AgeGateStep selected={tier} onSelect={setTier} />
      {tier && (
        <Input
          label={t("profile.age")}
          type="number"
          min={1}
          max={120}
          value={ageInput}
          onChange={(e) => setAgeInput(e.target.value)}
        />
      )}
      <Button
        className="w-full"
        disabled={!tier || !ageInput}
        onClick={() => {
          const ageValue = Number(ageInput);
          const derived = deriveAgeTier(ageValue);
          onContinue(derived, ageValue);
        }}
      >
        {t("common.next")}
      </Button>
    </div>
  );
}
