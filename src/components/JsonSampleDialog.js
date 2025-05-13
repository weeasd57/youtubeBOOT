'use client';

import { FaCode, FaTimes } from 'react-icons/fa';

export default function JsonSampleDialog({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <FaCode className="text-amber-500" />
            Sample TikTok JSON Structure
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            <p>This is a sample of the expected JSON structure from Apify.com's TikTok Scraper. Each item in the array represents a TikTok video with its metadata.</p>
          </div>
          <div className="overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
            <div className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex justify-between">
              <span>tiktok_sample_posts.json</span>
              <span className="text-amber-600 dark:text-amber-500">Apify TikTok Scraper Format</span>
            </div>
            <pre className="p-3 overflow-auto text-gray-800 dark:text-gray-300 text-xs leading-relaxed" style={{maxHeight: "50vh"}}>
{`[
  {
    "videoMeta.coverUrl": "https://p16-sign.example.com/obj/tos-generic-p-0037/sample_cover_image.jpg",
    "text": "QURAN  #tutorial #trending #fyp",
    "diggCount": 12500,
    "shareCount": 3200,
    "playCount": 285000,
    "commentCount": 420,
    "videoMeta.duration": 45,
    "isAd": false,
    "isMuted": false,
    "hashtags": [
      {
        "id": "1234567890123456",
        "name": "QURAN",
        "title": "",
        "cover": ""
      },
      {
        "id": "9876543210987654",
        "name": "tutorial",
        "title": "",
        "cover": ""
      },
      {
        "id": "2468135790123456",
        "name": "trending",
        "title": "",
        "cover": ""
      },
      {
        "id": "1357924680123456",
        "name": "fyp",
        "title": "",
        "cover": ""
      }
    ],
    "authorMeta.name": "dancerexample123",
    "webVideoUrl": "https://www.tiktok.com/@dancerexample123/video/1234567890123456789",
    "createTimeISO": "2023-05-15T14:23:45.000Z"
  },
  {
    "videoMeta.coverUrl": "https://p16-sign.example.com/tos-generic-p-0037/another_sample_cover_image.jpg",
    "text": "Recipe: How to make the perfect chocolate chip cookies 🍪 #baking #cookies #recipe #homemade #dessert",
    "diggCount": 8750,
    "shareCount": 1450,
    "playCount": 95000,
    "commentCount": 230,
    "videoMeta.duration": 60,
    "isAd": false,
    "isMuted": false,
    "hashtags": [
      {
        "id": "5678901234567890",
        "name": "baking",
        "title": "",
        "cover": ""
      },
      {
        "id": "1098765432109876",
        "name": "cookies",
        "title": "",
        "cover": ""
      },
      {
        "id": "6543210987654321",
        "name": "recipe",
        "title": "",
        "cover": ""
      },
      {
        "id": "7890123456789012",
        "name": "homemade",
        "title": "",
        "cover": ""
      },
      {
        "id": "3456789012345678",
        "name": "dessert",
        "title": "",
        "cover": ""
      }
    ],
    "authorMeta.name": "bakingmaster42",
    "webVideoUrl": "https://www.tiktok.com/@bakingmaster42/video/9876543210987654321",
    "createTimeISO": "2023-05-18T09:12:36.000Z"
  }
  /* ... more items ... */
]`}
            </pre>
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            <strong>Important fields:</strong> <span className="text-amber-600 dark:text-amber-500">webVideoUrl</span> (video URL), <span className="text-amber-600 dark:text-amber-500">text</span> (caption), <span className="text-amber-600 dark:text-amber-500">hashtags</span> (tags)
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 