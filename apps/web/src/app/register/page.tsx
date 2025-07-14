import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { SignupForm } from './signup-form';

export default function Page() {
  return (
    <div className="flex w-full h-full min-h-screen items-center justify-center">
      <Card className="shadow-2xl bg-zinc-100 rounded-lg p-4 w-120 max-w-m dark:bg-zinc-800">
        <CardTitle className="flex items-center justify-center">
          Create Your Account
        </CardTitle>
        <CardContent className="pt-8">
          <SignupForm />
        </CardContent>
        <p className="mt-6 text-center text-sm ">
          Already have an account?
          <a
            href="/signin"
            className="text-purple-600 hover:text-purple-800 font-medium transition duration-200"
          >
            Sign In
          </a>
        </p>
      </Card>
    </div>
  );
}
