import Header from '../components/Header'
import Footer from '../components/Footer'

const SignUp = () => (
  <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <Header />
    <main className="flex-1 flex flex-col items-center justify-center pt-28 pb-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Sign Up</h2>
        <form className="space-y-6">
          <input type="email" placeholder="Email" className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
          <input type="password" placeholder="Password" className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
          <input type="password" placeholder="Confirm Password" className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
          <button type="submit" className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold">Sign Up</button>
        </form>
      </div>
    </main>
    <Footer />
  </div>
)
export default SignUp 