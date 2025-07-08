import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <div className="bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Welcome Back
        </h2>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <a
            href="/signup"
            className="text-indigo-600 hover:text-indigo-800 font-medium transition duration-200"
          >
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
