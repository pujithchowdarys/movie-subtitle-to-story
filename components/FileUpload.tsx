import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onFileRead: (content: string, fileName: string) => void;
  acceptedFileTypes?: string; // e.g., ".srt,.txt"
  buttonText?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileRead,
  acceptedFileTypes = ".srt,.txt",
  buttonText = "Upload Subtitle/Transcript File",
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError("No file selected.");
      return;
    }

    if (!acceptedFileTypes.split(',').some(ext => file.name.endsWith(ext.trim()))) {
      setError(`Invalid file type. Please upload a ${acceptedFileTypes} file.`);
      return;
    }

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        onFileRead(content, file.name);
      } catch (err) {
        setError("Error reading file content.");
        console.error("File reading error:", err);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setLoading(false);
      console.error("FileReader error:", reader.error);
    };
    reader.readAsText(file);
  }, [onFileRead, acceptedFileTypes]);

  return (
    <div className="mb-4 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
      <label htmlFor="file-upload" className="sr-only">{buttonText}</label>
      <input
        id="file-upload"
        type="file"
        accept={acceptedFileTypes}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => document.getElementById('file-upload')?.click()}
        disabled={loading}
        className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
      >
        {loading ? (
          <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
        )}
        {loading ? 'Uploading...' : buttonText}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default FileUpload;
