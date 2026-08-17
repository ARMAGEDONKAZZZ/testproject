import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { MiniBoard } from "@/components/MiniBoard";
import { Pill } from "@/components/Pill";
import { ApiError } from "@/api/client";
import { useSharedFolder } from "@/features/folders/hooks";

/**
 * Bare /share/:slug entry point. A single-puzzle share (the common case —
 * see ShareModal, which always shares a hidden one-puzzle folder) redirects
 * straight into the guest solving view (SharedPuzzlePage) instead of
 * showing a one-item grid. A real multi-puzzle folder share still shows the
 * grid here, but its cards link to /share/:slug/:puzzleId (guest-viewable)
 * rather than the authenticated /puzzle/:id they used to point at — a
 * guest could never actually open that route.
 */
export default function SharedFolderPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [passwordInput, setPasswordInput] = useState("");
  const [password, setPassword] = useState<string | undefined>(undefined);
  const { data, error, isLoading } = useSharedFolder(slug, password);

  const needsPassword = error instanceof ApiError && error.status === 401;
  const notFound = error instanceof ApiError && error.status === 404;

  useEffect(() => {
    if (data && data.items.length === 1) {
      navigate(`/share/${slug}/${data.items[0].id}`, { replace: true });
    }
  }, [data, slug, navigate]);

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

        {data && data.items.length > 1 && (
          <>
            <h1 className="mb-6 text-2xl font-bold text-text-primary">{data.folder.name}</h1>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {data.items.map((p) => (
                <Link
                  key={p.id}
                  to={`/share/${slug}/${p.id}`}
                  className="block rounded-xl border border-border-subtle p-3 hover:border-accent-violet/60"
                >
                  <MiniBoard fen={p.fen} />
                  <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
                    <Pill tone="violet">{p.tag}</Pill>
                    <span>{p.sideToMove === "white" ? "White to move" : "Black to move"}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
