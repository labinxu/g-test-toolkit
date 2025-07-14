import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex w-full h-full min-h-screen items-center justify-center">
      <Card className="shadow-2xl bg-zinc-100 rounded-lg p-4 w-120 max-w-m dark:bg-zinc-800">
        <CardTitle className="flex items-center justify-center">
          Welcome Back
        </CardTitle>
        <CardContent className="pt-8">
          <LoginForm />
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
