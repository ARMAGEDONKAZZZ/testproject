import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ApiError } from "@/api/client";
import { useSharedFolder } from "@/features/folders/hooks";
import { PuzzleGrid } from "@/pages/folders/components/PuzzleGrid";

export default function SharedFolderPage() {
  const { slug } = useParams<{ slug: string }>();
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState<string | undefined>(undefined);
  const { data, error, isLoading } = useSharedFolder(slug, password);

  const needsPassword = error instanceof ApiError && error.status === 401;
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border-subtle px-6 py-3">
        <span className="text-lg font-bold text-accent-green">neuratop</span>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && <p className="text-text-secondary">Загрузка…</p>}

        {notFound && <Card className="text-center text-text-secondary">Папка не найдена или недоступна</Card>}

        {needsPassword && (
          <Card className="mx-auto max-w-sm text-center">
            <p className="mb-3 text-text-secondary">Установите пароль для просмотра</p>
            <Input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
            <Button className="mt-3 w-full" onClick={() => setPassword(passwordInput)}>
              Открыть
            </Button>
          </Card>
        )}

        {data && (
          <>
            <h1 className="mb-6 text-2xl font-bold text-text-primary">{data.folder.name}</h1>
            <PuzzleGrid puzzles={data.items} />
          </>
        )}
      </main>
    </div>
  );
}
