import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md ">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Welcome Back
        </h2>
        <div className="space-y-6">
          <div>
            <Label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
            />
          </div>
          <div>
            <Label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="mt-1 w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-200"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Input
                id="remember"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <Label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                Remember me
              </Label>
            </div>
            <a
              href="#"
              className="text-sm text-indigo-600 hover:text-indigo-800 transition duration-200"
            >
              Forgot Password?
            </a>
          </div>
          <Button className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition duration-200 font-semibold">
            Sign In
          </Button>
        </div>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?
          <a
            href="#"
            className="text-indigo-600 hover:text-indigo-800 font-medium transition duration-200"
          >
            Sign Up
          </a>
        </p>
      </div>
    </div>
  );
}
