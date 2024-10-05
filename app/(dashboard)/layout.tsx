import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Toaster } from "@/components/ui/toaster";

const Logo = () => (
  <span className="ml-2 font-semibold text-gray-900 flex items-center">
    <span className="text-2xl transform scale-y-75">S</span>
    <span className="text-xl">hortest</span>
  </span>
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <SignedIn>
              <Link href="/dashboard" className="flex items-center">
                <Logo />
              </Link>
            </SignedIn>
            <SignedOut>
              <Link href="/" className="flex items-center">
                <Logo />
              </Link>
            </SignedOut>

            {/* Aligning Repositories link to the left */}
            <SignedIn>
              <nav className="flex space-x-6">
                <Link
                  href="/dashboard/repos"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Repositories
                </Link>
                {/* Space for more future links */}
              </nav>
            </SignedIn>
          </div>

          <div className="flex items-center space-x-4">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      {children}
      <Toaster />
    </ClerkProvider>
  );
}
