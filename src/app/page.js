'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import Link from 'next/link';
import { 
  FaGoogle, 
  FaCalendarAlt, 
  FaUsers, 
  FaChartLine, 
  FaRocket,
  FaCheck,
  FaArrowRight,
  FaPlay
} from 'react-icons/fa';
import ThemeToggle from '@/components/ThemeToggle';

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { 
        callbackUrl: '/dashboard',
        redirect: true 
      });
    } catch (error) {
      console.error('Sign in error:', error);
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 relative">
                <Image 
                  src="/android-chrome-192x192.png" 
                  alt="Content Scheduler"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
              </div>
              <span className="text-xl font-semibold text-gray-900">Content Scheduler</span>
            </div>
            
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                className="btn btn-primary"
              >
                <FaGoogle />
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-white py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight">
                Schedule content like a
                <span className="text-blue-600"> pro</span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
                The smarter way to manage your social media content. 
                Connect multiple accounts, schedule posts, and grow your audience effortlessly.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="btn btn-primary text-lg px-8 py-4"
                >
                  <FaGoogle />
                  {isLoading ? 'Starting...' : 'Get started for free'}
                </button>
                <a
                  href="#features"
                  className="btn btn-secondary text-lg px-8 py-4"
                >
                  <FaPlay />
                  See how it works
                </a>
              </div>

              <div className="mt-12">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaCalendarAlt className="text-white text-2xl" />
                      </div>
                      <p className="text-gray-600">Dashboard Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">
                Everything you need to manage content
              </h2>
              <p className="mt-4 text-xl text-gray-600">
                Powerful tools designed for content creators and teams
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="card p-8 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <FaUsers className="text-blue-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Multi-Account Management
                </h3>
                <p className="text-gray-600">
                  Connect multiple Google accounts and YouTube channels. 
                  Switch between accounts seamlessly in one dashboard.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="card p-8 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <FaCalendarAlt className="text-green-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Smart Scheduling
                </h3>
                <p className="text-gray-600">
                  Schedule your content for optimal times. 
                  Batch upload and let our system handle the publishing.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="card p-8 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <FaChartLine className="text-purple-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Analytics & Insights
                </h3>
                <p className="text-gray-600">
                  Track your content performance and get insights 
                  to improve your publishing strategy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900">
                How it works
              </h2>
              <p className="mt-4 text-xl text-gray-600">
                Get started in minutes with our simple workflow
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">1</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Connect Accounts
                </h3>
                <p className="text-gray-600">
                  Link your Google Drive and YouTube accounts securely
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">2</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Content
                </h3>
                <p className="text-gray-600">
                  Add your videos and organize them in your library
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">3</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Schedule Posts
                </h3>
                <p className="text-gray-600">
                  Set your publishing schedule and customize each post
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">4</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Auto-Publish
                </h3>
                <p className="text-gray-600">
                  Sit back while your content gets published automatically
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Why content creators choose us
                </h2>
                
                <ul className="space-y-4">
                  {[
                    'Save hours every week with automated scheduling',
                    'Manage multiple brands from one dashboard',
                    'Never miss a posting deadline again',
                    'Optimize posting times for maximum reach',
                    'Keep your content organized and accessible'
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FaCheck className="text-green-600 text-sm" />
                      </div>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <FaRocket className="text-4xl text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Feature showcase</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to streamline your content?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of creators who save time and grow their audience with smart scheduling
            </p>
            
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="bg-white text-blue-600 hover:bg-gray-50 px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 inline-flex items-center gap-3"
            >
              <FaGoogle />
              {isLoading ? 'Starting...' : 'Start free today'}
              <FaArrowRight />
            </button>
            
            <p className="text-blue-100 text-sm mt-4">
              No credit card required • Free forever plan available
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 relative">
                  <Image 
                    src="/android-chrome-192x192.png" 
                    alt="Content Scheduler"
                    width={32}
                    height={32}
                    className="rounded-lg"
                  />
                </div>
                <span className="text-xl font-semibold text-white">Content Scheduler</span>
              </div>
              <p className="text-gray-400 max-w-md">
                The smart way to manage and schedule your social media content across multiple platforms and accounts.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Content Scheduler. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}