import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LinkZahraaForm } from "./link-form";
import DottedTrailCursor from "@/components/ui/dotted-trail-cursor";
import { Navbar } from "@/components/navbar";

export default async function LinkZahraaPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.approval_status !== "approved") {
    redirect("/pending");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar user={user} />

      <main className="flex-1 relative">
        <DottedTrailCursor
          colorA="#f59e0b"
          colorB="#f43f5e"
          headRadius={70}
          className="!min-h-[calc(100vh-4rem)] !h-auto flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md my-8">
            <LinkZahraaForm
              studentName={user.full_name}
              isInvalid={user.credentials_invalid}
            />
          </div>
        </DottedTrailCursor>
      </main>
    </div>
  );
}
