import Link from 'next/link';
import { FaGithub, FaTwitter, FaYoutube } from 'react-icons/fa';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h2 className="text-xl font-bold">YouTubeBOOT</h2>
            <p className="text-gray-400 text-sm mt-1">© {currentYear} YouTubeBOOT. All rights reserved.</p>
          </div>
          
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-8">
            <div className="flex flex-col">
              <h3 className="font-semibold mb-2">Legal</h3>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors mt-1">
                Privacy Policy
              </Link>
            </div>
            
            
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-gray-500 text-sm">
          <p>This service is not affiliated with or endorsed by YouTube.</p>
        </div>
      </div>
    </footer>
  );
}
