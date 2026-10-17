"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Utensils, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import { useRouter } from "next/navigation";

export function Navbar({
  user,
  isAdmin = false,
}: {
  user?: { email?: string; full_name?: string } | null;
  isAdmin?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 transition-transform active:scale-95">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-start">
            <span className="text-base font-bold text-foreground">مساعد الزهراء</span>
            <span className="text-[10px] text-muted-foreground">جامعة القاهرة</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5 rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400">
                <Shield className="h-4 w-4" />
                لوحة الأدمن
              </Button>
            </Link>
          )}

          {/* Dark / Light Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="تبديل المظهر"
            className="rounded-xl h-10 w-10 min-h-[40px] min-w-[40px]"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-rose-400" />
          </Button>

          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive gap-1.5 rounded-xl h-10 min-h-[40px]"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
