import { SignupForm } from './signup-form';

export default function Page() {
  return (
    <div className="bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Create Your Account
        </h2>

        <SignupForm />
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?
          <a
            href="/signin"
            className="text-purple-600 hover:text-purple-800 font-medium transition duration-200"
          >
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
