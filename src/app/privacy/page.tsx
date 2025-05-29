'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-700/20 p-8 transition-colors duration-300">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Last updated: May 30, 2025</p>
          </div>

          <div className="prose max-w-none text-gray-800 dark:text-gray-200 prose-headings:dark:text-white prose-a:dark:text-amber-400">
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">1. Information We Collect</h2>
              <p>We collect information that you provide directly to us, such as when you create an account, update your profile, or contact us. This may include:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Your name and email address</li>
                <li>Profile information</li>
                <li>Content you upload or share</li>
                <li>Scheduled posts for YouTube and TikTok</li>
                <li>Google Drive storage preferences</li>
                <li>Payment information (if applicable)</li>
                <li>TikTok account information (with your consent)</li>
                <li>YouTube account and channel information (with your consent)</li>
                <li>Google Drive files and metadata (with your consent)</li>
              </ul>
              <p>We also automatically collect certain information when you use our service, including:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Log information (e.g., IP address, browser type)</li>
                <li>Usage data and analytics</li>
                <li>Device information</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">2. YouTube and Google Drive Data Collection</h2>
              <p>When you connect your Google account to our service, we may collect the following information through the YouTube API Services and Google Drive API:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>YouTube channel information (name, ID, statistics)</li>
                <li>YouTube video information (titles, descriptions, thumbnails)</li>
                <li>YouTube video analytics and metrics</li>
                <li>Google Drive file listings and metadata</li>
                <li>Content of video files stored in your Google Drive (with your explicit consent)</li>
              </ul>
              <p>Our use of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              <p>You can revoke access to your Google account at any time through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">Google Account settings</a>.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">3. TikTok Data Collection</h2>
              <p>When you connect your TikTok account to our service, we may collect the following information through the TikTok API:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Basic account information (username, profile picture)</li>
                <li>Content you've published to TikTok (with your authorization)</li>
                <li>Video analytics and metrics</li>
                <li>Comment and engagement data</li>
              </ul>
              <p>We only access this information with your explicit consent and in accordance with TikTok's Platform Terms. You can revoke access at any time through your TikTok account settings.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">4. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Provide, maintain, and improve our service</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends and usage</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Enable TikTok content scheduling and management</li>
                <li>Facilitate content sharing between platforms</li>
                <li>Upload videos from Google Drive to your YouTube channel</li>
                <li>Manage and schedule your YouTube content</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">5. YouTube and Google Drive Data Usage</h2>
              <p>Information collected from YouTube and Google Drive is used solely for the purposes of:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Uploading videos from your Google Drive to your YouTube channel</li>
                <li>Creating and managing YouTube video metadata (titles, descriptions, etc.)</li>
                <li>Scheduling YouTube video uploads and publications</li>
                <li>Providing analytics and insights about your YouTube channel performance</li>
                <li>Browsing and selecting videos from your Google Drive for upload</li>
              </ul>
              <p>Our use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              <p>We will not:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Sell your YouTube or Google Drive data to third parties</li>
                <li>Use your data for any purpose not clearly disclosed to you</li>
                <li>Store your data longer than necessary to provide our services</li>
                <li>Use your data for advertising purposes without your explicit consent</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">6. TikTok Data Usage</h2>
              <p>Information collected from TikTok is used solely for the purposes of:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Providing you with TikTok content management and scheduling</li>
                <li>Displaying your TikTok content within our service</li>
                <li>Analyzing performance of your TikTok content</li>
                <li>Facilitating cross-platform content strategy</li>
              </ul>
              <p>We will not:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Sell your TikTok data to third parties</li>
                <li>Use TikTok data for any purpose not clearly disclosed to you</li>
                <li>Store TikTok data longer than necessary to provide our services</li>
                <li>Combine TikTok data with data from other sources in ways not permitted by TikTok</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">7. Information Sharing</h2>
              <p>We do not share your personal information with third parties except as described in this policy. We may share information with:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Service providers who perform services on our behalf</li>
                <li>Business partners with your consent</li>
                <li>Law enforcement or other government officials, in response to a verified request</li>
                <li>Other parties in connection with a merger, acquisition, or sale of assets</li>
              </ul>
              <p>Data shared with TikTok through our service is subject to TikTok's Privacy Policy.</p>
              <p>Data shared with Google services (YouTube and Google Drive) through our service is subject to Google's Privacy Policy.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">8. Data Security</h2>
              <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">9. Your Data Protection Rights</h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li>Access, update, or delete your personal information</li>
                <li>Rectify inaccurate or incomplete data</li>
                <li>Object to or restrict processing of your personal information</li>
                <li>Request data portability</li>
                <li>Withdraw consent</li>
              </ul>
              <p>To exercise these rights, please contact us at{' '}
                <a href="mailto:weeessd57@gmail.com" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">
                  weeessd57@gmail.com
                </a>.</p>
              <p>You can also manage TikTok permissions through your TikTok account settings.</p>
              <p>You can manage Google API permissions through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">Google Account settings</a>.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">10. Children's Privacy</h2>
              <p>Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">11. Changes to This Privacy Policy</h2>
              <p>We may update our Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date at the top of this page and, in some cases, we may provide additional notice (such as adding a statement to our homepage or sending you a notification).</p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">12. Third-Party Services</h2>
              <p>Our service integrates with third-party services including Google (YouTube and Drive) and TikTok. Your use of these third-party services is subject to their respective privacy policies:</p>
              <ul className="list-disc pl-6 space-y-2 dark:text-gray-300">
                <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">Google Privacy Policy</a></li>
                <li><a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">YouTube Terms of Service</a></li>
                <li><a href="https://www.tiktok.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">TikTok Privacy Policy</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">13. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:weeessd57@gmail.com" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline transition-colors">
                  weeessd57@gmail.com
                </a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
