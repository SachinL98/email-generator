import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
 
import { createPortal } from 'react-dom';

// =========================================================================
//  IMPORTANT: YOU MUST REPLACE THESE PLACEHOLDER VALUES WITH YOUR OWN
//  FIREBASE PROJECT'S CONFIGURATION.
//  THIS IS THE CAUSE OF THE "auth/api-key-not-valid" ERROR.
// =========================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyBtfHsX9opID8n0O63l3I7Nr4A3wkee7Bg",
    authDomain: "email-generator-542c0.firebaseapp.com",
    projectId: "email-generator-542c0",
    storageBucket: "email-generator-542c0.firebasestorage.app",
    messagingSenderId: "799950310758",
    appId: "1:799950310758:web:83d6558298f8830ee54ca7",
    measurementId: "G-0YKKVV7FVB"
  };

// Unique application identifier for Firestore paths.
const appId = firebaseConfig.projectId;

// Tailwind CSS classes for consistent styling
const containerClass = "bg-white p-8 md:p-12 rounded-2xl shadow-xl space-y-8 max-w-5xl w-full mx-auto transform transition-all duration-300";
const inputClass = "w-full p-4 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 shadow-sm text-gray-800 placeholder-gray-400";
const buttonClass = "bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 active:scale-95";
const secondaryButtonClass = "bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg shadow-sm hover:bg-gray-300 transition-all duration-200 transform hover:scale-105 active:scale-95";

// A modal component for settings
const SettingsModal = ({ isVisible, onClose, companyMission, setCompanyMission, senderName, setSenderName, senderEmail, setSenderEmail, onSave, isSaving }) => {
  if (!isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
        <h2 className="text-3xl font-extrabold text-gray-800 mb-6">Company Settings</h2>
        <p className="text-gray-600 mb-6">
          These details are used by the AI to craft your replies. They are saved securely.
        </p>
        <div className="space-y-6">
          <label className="block text-gray-700 font-medium">
            Your Name (as the sender):
            <input
              type="text"
              className={inputClass}
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="e.g., The Seamless Source Team"
            />
          </label>
          <label className="block text-gray-700 font-medium">
            Your Email:
            <input
              type="email"
              className={inputClass}
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="e.g., team@seamlesssource.com"
            />
          </label>
          <label className="block text-gray-700 font-medium">
            Company Mission / Product Description:
            <textarea
              className={inputClass + " h-32 resize-none"}
              value={companyMission}
              onChange={(e) => setCompanyMission(e.target.value)}
              placeholder="e.g., Our company, Seamless Source, is a leader in the fashion industry, offering a revolutionary DPP product..."
            />
          </label>
        </div>
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className={buttonClass}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const icon = type === 'success' ? '✔' : '✖';
  
  if (!message) return null;

  return createPortal(
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-lg text-white font-semibold ${bgColor} z-[100]`}>
      <div className="flex items-center space-x-2">
        <span>{icon}</span>
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 text-white opacity-75 hover:opacity-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
};

// Main application component
function App() {
  const [incomingEmail, setIncomingEmail] = useState('');
  const [generatedReply, setGeneratedReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });

  const [companyMission, setCompanyMission] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Firestore & Auth state
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);

  // Function to show a toast message
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: '' }), 3000);
  };

  // Function to copy text to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedReply);
      showToast('Reply copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showToast('Failed to copy text.', 'error');
    }
  };

  // 1. Initialize Firebase and handle authentication
  useEffect(() => {
    const initFirebase = async () => {
      // Add a check to warn the user if they haven't updated the config
      if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.error("Firebase initialization failed: Please replace the placeholder values in the firebaseConfig object with your actual project details.");
        setError("Failed to initialize the application. Please update your Firebase configuration.");
        return;
      }
      try {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestore);
        
        // Sign in anonymously since this is a simple, standalone app
        await signInAnonymously(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(null); // No user signed in
          }
        });
        return () => unsubscribe();
      } catch (e) {
        console.error("Firebase initialization failed:", e);
        setError("Failed to initialize the application. Check your Firebase config.");
      }
    };
    initFirebase();
  }, []);

  // 2. Fetch company data
  useEffect(() => {
    if (!db || !userId) return;

    const companyDocRef = doc(db, `/artifacts/${appId}/users/${userId}/companyData/details`);
    const unsubscribe = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyMission(data.mission);
        setSenderName(data.senderName);
        setSenderEmail(data.senderEmail);
      } else {
        // Set default values if no data exists
        setCompanyMission('Our company, Seamless Source, is a leader in the fashion industry, offering a revolutionary DPP (Digital Product Passport) product that helps brands track their supply chain, ensure ethical sourcing, and build trust with their customers.');
        setSenderName('The Seamless Source Team');
        setSenderEmail('team@seamlesssource.com');
      }
    }, (e) => {
      console.error("Failed to fetch company data:", e);
      setError("Failed to fetch company details from the database.");
    });

    return () => unsubscribe();
  }, [db, userId, appId]);

  // 3. Function to save company details to Firestore
  const saveCompanyDetails = async () => {
    if (!db || !userId) {
      showToast("Database not ready. Please wait a moment.", 'error');
      return;
    }
    setIsSaving(true);
    try {
      const companyDocRef = doc(db, `/artifacts/${appId}/users/${userId}/companyData/details`);
      await setDoc(companyDocRef, {
        mission: companyMission,
        senderName: senderName,
        senderEmail: senderEmail
      });
      showToast('Company details saved successfully!', 'success');
      setShowSettings(false); // Close the modal
    } catch (e) {
      console.error("Error saving company details:", e);
      showToast("Failed to save company details. Please try again.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Function to generate the reply using the Gemini API
  const generateReply = async () => {
    if (!incomingEmail) {
      setError("Please enter the incoming email text to generate a reply.");
      return;
    }

    setLoading(true);
    setGeneratedReply('');
    setError(null);

    const prompt = `
      You are a member of the marketing team for "Seamless Source."
      Your product is a "DPP (Digital Product Passport)" for the fashion industry.
      Your goal is to reply to an incoming email from a potential client.
      Your company mission is: "${companyMission}"
      
      Your reply must be:
      1.  Polite, professional, and caring.
      2.  Written from the perspective of a team member at "Seamless Source."
      3.  Focused on addressing the client's inquiry while subtly but clearly highlighting the value and importance of our DPP product.
      4.  Designed to push the client towards a next step, such as a product demo or a call.

      Incoming Email from client:
      ---
      ${incomingEmail}
      ---

      Reply as if you are the sender: ${senderName} <${senderEmail}>
      Do not include "Subject:" or any email headers. Just the body of the email.
    `;

    try {
      const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      const apiKey = ""; // API key is automatically provided in the canvas environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        setGeneratedReply(text);
      } else {
        setError('Failed to generate a reply. Please try again.');
      }
    } catch (e) {
      console.error("Error generating reply:", e);
      setError("An error occurred while generating the reply. Please check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-10 lg:p-16 flex items-center justify-center font-['Inter']">
      <div className="w-full">
        <header className="flex items-center justify-between mb-8 md:mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            Seamless Source <span className="text-purple-600">AI</span>
          </h1>
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-500 hover:text-purple-600 transition-colors duration-200"
            title="Edit Company Details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </header>

        {/* Main Application Card */}
        <div className={containerClass}>
          {/* User ID and Welcome Message */}
          {userId && (
            <div className="text-center text-gray-500 mb-6 -mt-4">
              Signed in as: <span className="font-mono text-xs bg-gray-100 p-1 rounded-md break-all">{userId}</span>
            </div>
          )}

          <h2 className="text-3xl font-bold text-gray-800 mb-4">Reply Generator</h2>
          <p className="text-gray-600 mb-6">
            Paste an incoming email below, and I'll draft a professional, on-brand reply for you.
          </p>

          <label className="block text-gray-700 font-medium sr-only">
            Paste Incoming Email Here:
          </label>
          <textarea
            className={inputClass + " h-48 resize-none"}
            value={incomingEmail}
            onChange={(e) => setIncomingEmail(e.target.value)}
            placeholder="Paste the full incoming email here..."
          />
          
          <button
            onClick={generateReply}
            className={buttonClass + " w-full"}
            disabled={loading || !userId}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </div>
            ) : 'Generate Reply'}
          </button>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mt-4" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* Generated Reply Section */}
          {generatedReply && (
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 rounded-full h-8 w-8 flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                Generated Reply
              </h3>
              <div className="bg-gray-100 p-6 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed text-gray-800">
                {generatedReply}
              </div>
              <button
                onClick={copyToClipboard}
                className={buttonClass + " mt-4"}
              >
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy to Clipboard
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Settings Modal */}
      <SettingsModal
        isVisible={showSettings}
        onClose={() => setShowSettings(false)}
        companyMission={companyMission}
        setCompanyMission={setCompanyMission}
        senderName={senderName}
        setSenderName={setSenderName}
        senderEmail={senderEmail}
        setSenderEmail={setSenderEmail}
        onSave={saveCompanyDetails}
        isSaving={isSaving}
      />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: '' })}
      />
    </div>
  );
}

export default App;
