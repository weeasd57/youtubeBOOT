'use client';

import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-700/20 p-8 transition-colors duration-300">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Last updated: May 30, 2025</p>
          </div>

          <div className="prose max-w-none text-gray-800 dark:text-gray-200 prose-headings:dark:text-white prose-a:dark:text-amber-400">
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">1. Introduction</h2>
              <p>Welcome to YouTubeBOOT. These Terms of Service ("Terms") govern your use of our website, services, and our integrations with YouTube, Google Drive, and TikTok.</p>
              <p>By accessing or using our service, you agree to be bound by these Terms and to comply with all applicable Google API Services User Data Policy and TikTok Platform Terms.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">2. YouTube and Google Drive Integration</h2>
              <p>Our service uses the YouTube API Services and Google Drive API. By using our service, you are agreeing to be bound by the Google Terms of Service (<a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">https://policies.google.com/terms</a>).</p>
              <p>When using YouTube and Google Drive related features, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Comply with all applicable YouTube Terms of Service</li>
                <li>Comply with the Google API Services User Data Policy, including the Limited Use requirements (<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">https://developers.google.com/terms/api-services-user-data-policy</a>)</li>
                <li>Not use YouTube or Google Drive data for any unauthorized purpose</li>
                <li>Not attempt to access data beyond what is necessary for the functionality of our service</li>
                <li>Respect YouTube's and Google Drive's intellectual property rights</li>
              </ul>
              <p>You can revoke our access to your Google account at any time by visiting your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account settings</a>.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">3. TikTok Platform Integration</h2>
              <p>Our service integrates with the TikTok Platform. When using TikTok-related features, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Comply with all TikTok Platform Terms and Community Guidelines</li>
                <li>Not use TikTok data for any unauthorized purpose</li>
                <li>Not attempt to identify users based on TikTok data</li>
                <li>Not engage in activities that may compromise TikTok's security</li>
                <li>Not use automated means to access TikTok services outside of our approved integration</li>
                <li>Respect TikTok's intellectual property rights</li>
              </ul>
              <p>We reserve the right to modify our TikTok integration at any time, including in response to changes in TikTok's Platform Terms or API.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">4. Account Registration</h2>
              <p>To access certain features, you may need to create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.</p>
              <p>When using our service, you may need to authorize our application to access your Google (YouTube and Drive) and TikTok accounts. You can revoke this access at any time through your respective account settings.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">5. User Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>You must be at least 13 years old to use our service.</li>
                <li>You are responsible for all content you upload or share.</li>
                <li>You agree to comply with all applicable laws and regulations.</li>
                <li>You will not use our service for any illegal or unauthorized purpose.</li>
                <li>You may schedule posts for both YouTube and TikTok.</li>
                <li>You can store your videos in Google Drive before uploading.</li>
                <li>You will not attempt to circumvent any limitations in our service integrations.</li>
                <li>You will not use our service to violate YouTube's, Google's, or TikTok's terms of service.</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">6. Intellectual Property</h2>
              <p>All content and materials available on our website, including but not limited to text, graphics, logos, and software, are the property of YouTubeBOOT or its licensors and are protected by intellectual property laws.</p>
              <p>YouTube and Google Drive content accessed through our service remains subject to Google's terms and policies. TikTok content accessed through our service remains the property of TikTok and its users.</p>
              <p>You may not use content from these platforms in ways that violate their respective Terms of Service or Community Guidelines.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">7. Google API Services User Data Policy</h2>
              <p>Our use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              <p>This means that we will:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Only request access to the data our service needs to function</li>
                <li>Use your Google user data only for the purposes you've explicitly authorized</li>
                <li>Not sell your Google user data</li>
                <li>Not use your Google user data for advertising purposes</li>
                <li>Not mislead you about what data we're accessing or how we're using it</li>
                <li>Keep your Google user data secure</li>
                <li>Only retain your data for as long as necessary to provide you with our service</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">8. Limitation of Liability</h2>
              <p>In no event shall YouTubeBOOT be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of our service.</p>
              <p>We are not responsible for any issues arising from changes to the YouTube API, Google Drive API, or TikTok API or platform policies that may affect our service.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">9. Changes to Terms</h2>
              <p>We reserve the right to modify these Terms at any time. We will provide notice of any changes by updating the "Last updated" date at the top of this page.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">10. Third-Party Services</h2>
              <p>Our service integrates with third-party services, including YouTube, Google Drive, and TikTok. Your use of these third-party services is subject to their respective terms of service and privacy policies:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a></li>
                <li><a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Google Terms of Service</a></li>
                <li><a href="https://www.tiktok.com/legal/terms-of-service" target="_blank" rel="noopener noreferrer">TikTok Terms of Service</a></li>
              </ul>
              <p>YouTube is a trademark of Google LLC. TikTok is a trademark of ByteDance Ltd. Our service is not endorsed by or affiliated with Google or TikTok unless explicitly stated.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">11. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at{' '}
                <a href="mailto:weeessd57@gmail.com" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">
                  weeessd57@gmail.com
                </a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
