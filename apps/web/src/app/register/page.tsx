'use client';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { SignupForm } from './signup-form';

export default function Page() {
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center">
      <Card className="w-120 max-w-m rounded-lg bg-zinc-100 p-4 shadow-2xl dark:bg-zinc-800">
        <CardTitle className="flex items-center justify-center">
          Create Your Account
        </CardTitle>
        <CardContent className="pt-8">
          <SignupForm />
        </CardContent>
        <p className="mt-6 text-center text-sm">
          Already have an account?
          <a
            href="/signin"
            className="font-medium text-purple-600 transition duration-200 hover:text-purple-800"
          >
            Sign In
          </a>
        </p>
      </Card>
    </div>
  );
}
