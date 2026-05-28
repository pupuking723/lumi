"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Bell,
  ChevronRight,
  Lock,
} from "lucide-react";
import { AppChrome } from "./app-chrome";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { apiClient } from "@/lib/api/client";

const profileItems = [
  {
    label: "Notifications",
    description: "Message alerts, Live reminders, look recaps",
    href: "/profile/notifications",
    icon: Bell,
  },
];

export function ProfileView({ settings = false }: { settings?: boolean }) {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: apiClient.getMe,
  });
  const { data: session, status } = useSession();
  const user = status === "authenticated" ? session?.user : undefined;
  const displayName = user?.name ?? me?.displayName ?? "Guest";
  const email = user?.email;
  const avatarUrl = user?.image ?? session?.goclawUser?.avatar;

  return (
    <AppChrome contentScroll>
      <div className="mx-auto max-w-[620px] space-y-5 pb-8">
        <section className="rounded-[28px] border border-white/72 bg-[#fbfafc]/72 p-4 shadow-[0_18px_48px_rgba(47,45,58,0.08)] backdrop-blur-xl">
          {user ? (
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar name={displayName} image={avatarUrl} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold leading-tight text-[#302d43]">
                  {displayName}
                </h1>
                {email && (
                  <p className="mt-1 truncate text-sm font-bold text-[#8a8297]">
                    {email}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-extrabold leading-tight text-[#302d43]">
                  Sign in to personalize Lumi
                </h1>
                <p className="mt-2 text-sm font-bold leading-6 text-[#7a7289]">
                  Connect Google so Mochi can keep your style memory and account
                  settings together.
                </p>
              </div>
              <GoogleAuthButton />
            </div>
          )}
        </section>

        <ProfileSection title="Account">
          <div className="overflow-hidden rounded-[28px] border border-white/72 bg-white/58 p-2 shadow-[0_18px_48px_rgba(47,45,58,0.07)] backdrop-blur-xl">
          {profileItems.map((item) => (
            <ProfileLinkRow key={item.label} item={item} />
          ))}
          </div>
        </ProfileSection>

        {settings && (
          <section className="space-y-3 border-t border-[#dedbe2] pt-5">
            <h2 className="text-lg font-extrabold text-[#242235]">
              Frontend adapter
            </h2>
            <p className="text-sm font-semibold leading-6 text-[#716a7e]">
              Set <code className="font-extrabold">NEXT_PUBLIC_API_BASE_URL</code>{" "}
              to connect Lumi to the external backend. Leave it empty to use the
              local mock adapter.
            </p>
            <div className="rounded-[18px] bg-[#edeaf1] px-3 py-2 text-xs font-extrabold text-[#5f586f]">
              Current mode:{" "}
              {process.env.NEXT_PUBLIC_API_BASE_URL ? "external API" : "mock API"}
            </div>
          </section>
        )}

        <section className="rounded-[26px] border border-[#d7eadf] bg-[#effaf6]/74 p-4 shadow-[0_14px_36px_rgba(47,45,58,0.05)]">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 text-[#157464]" size={20} aria-hidden />
            <div>
              <h2 className="text-sm font-extrabold text-[#157464]">
                Privacy by default
              </h2>
              <p className="mt-1 text-sm font-bold leading-6 text-[#4b8178]">
                Your photos, sizes, and memories are private by default. Once the
                backend is connected, full permission controls will live here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppChrome>
  );
}

function ProfileAvatar({
  name,
  image,
}: {
  name: string;
  image?: string | null;
}) {
  const initial = (name.trim().charAt(0) || "L").toUpperCase();

  return (
    <span
      className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/80 bg-[#e7e4ec] text-xl font-black text-[#5f586f] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_14px_32px_rgba(42,39,55,0.12)]"
      style={
        image
          ? {
              backgroundImage: `url(${image})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
      aria-label={image ? `${name} avatar` : undefined}
    >
      {!image && initial}
    </span>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-xs font-black uppercase tracking-[0.22em] text-[#8f8994]">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function ProfileLinkRow({ item }: { item: (typeof profileItems)[number] }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-4 rounded-[22px] px-3 py-3 text-[#343145] transition hover:bg-white/62"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-[#e7e4ec] text-[#5f586f]">
          <Icon size={17} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold">{item.label}</span>
          <span className="mt-0.5 block truncate text-xs font-bold text-[#8a8297]">
            {item.description}
          </span>
        </span>
      </span>
      <ChevronRight className="shrink-0 text-[#5f586f]" size={17} aria-hidden />
    </Link>
  );
}
