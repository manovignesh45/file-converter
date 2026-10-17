# File Converter - Professional Image & Document Processing Platform

A full-stack file conversion platform built with Next.js, MongoDB, and Tailwind CSS. This application provides comprehensive image processing capabilities including compression, resizing, format conversion, PDF generation, watermarking, and PDF compression.

## 🚀 Features

### Core Image Processing
- **Image Compression**: Reduce file size with quality control and target size options
- **Image Resizing**: Change dimensions with aspect ratio preservation and crop options
- **Format Conversion**: Convert between JPG, PNG, and WebP formats
- **PDF Generation**: Combine multiple images into a single PDF document
- **PDF Compression**: Compress existing PDF files to reduce size
- **Watermarking**: Add text watermarks with customizable positioning

### Advanced User Experience
- **Drag & Drop Upload**: Intuitive file upload with instant previews
- **Real-time Size Estimation**: Preview compression ratios before processing
- **Batch Processing**: Handle multiple images simultaneously
- **File Reordering**: Drag to reorder images before PDF conversion
- **Progress Tracking**: Real-time processing status updates
- **ZIP Downloads**: Download all processed files in a single archive

### Technical Features
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **MongoDB Integration**: Persistent job tracking and file history
- **Optimized Processing**: Uses Sharp for high-performance image processing
- **Modular Architecture**: Clean, maintainable service-based structure
- **Automatic Cleanup**: Processed files are automatically deleted when starting new sessions

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MongoDB with Mongoose
- **Image Processing**: Sharp
- **PDF Generation**: pdf-lib
- **File Handling**: Multer, Archiver
- **UI Components**: Lucide React icons
- **Drag & Drop**: react-dropzone, react-sortable-hoc

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd file-converter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/file-converter
   REDIS_URL=redis://localhost:6379
   MAX_FILE_SIZE=52428800
   PROCESSED_FILES_DIR=./public/processed
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system or use MongoDB Atlas.

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Project Structure

```
file-converter/
├── app/                          # Next.js 13+ app directory
│   ├── api/                      # API routes
│   │   ├── process/             # Main processing endpoint
│   │   ├── download/            # File download endpoints
│   │   ├── preview/             # File preview endpoints
│   │   └── estimate/            # Size estimation endpoint
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main application page
├── components/                   # React components
│   ├── DragDropUploader.tsx     # File upload component
│   ├── PreviewCard.tsx          # Image preview component
│   ├── OptionsPanel.tsx         # Processing options
│   ├── ProgressModal.tsx        # Processing progress modal
│   ├── ResultsView.tsx          # Results display
│   └── Header.tsx               # Application header
├── services/                     # Business logic services
│   ├── imageCompressionService.ts
│   ├── imageResizeService.ts
│   ├── imageToPdfService.ts
│   └── formatConversionService.ts
├── lib/                         # Utility libraries
│   ├── mongodb.ts               # Database connection
│   └── models.ts                # Database models
├── public/                      # Static assets
│   └── processed/               # Processed files directory
├── package.json
├── tailwind.config.js
├── next.config.js
└── tsconfig.json
```

## 🎯 Usage

### Image Compression
1. Upload images using drag & drop or file selection
2. Select "Compress" operation
3. Adjust quality slider or set target file size
4. Preview estimated compression ratio
5. Process images and download results

### Image Resizing
1. Upload images
2. Select "Resize" operation
3. Set width/height dimensions
4. Choose aspect ratio and crop options
5. Process and download resized images

### PDF Generation
1. Upload multiple images
2. Drag to reorder images as needed
3. Select "PDF" operation
4. Choose page size and orientation
5. Generate and download PDF

### Format Conversion
1. Upload images
2. Select "Convert" operation
3. Choose target format (JPG, PNG, WebP)
4. Set quality options
5. Convert and download

### Watermarking
1. Upload images
2. Select "Watermark" operation
3. Enter watermark text
4. Choose position and styling
5. Apply watermark and download

### PDF Compression
1. Upload PDF files
2. Select "PDF Compress" operation
3. Adjust quality slider or set target file size
4. Choose optimization options
5. Process and download compressed PDFs

### Edit PDF
1. Upload one PDF file up to 50 MB
2. Choose **Edit PDF** and open the editor
3. Add text, PNG/JPEG images, shapes, arrows, drawings, and highlights
4. Use the page controls, zoom, selection handles, undo, redo, delete, and layer controls
5. Export and download a new PDF; the original file is never overwritten

The editor stores added elements in PDF page coordinates and preserves the original page content as vectors. It does not directly replace arbitrary text already present in a PDF. Scanned text is viewable and annotatable but requires a future OCR workflow before it can be edited. Password-protected PDFs can be opened with their password; the edited export is currently an unlocked copy.

## 🔧 Configuration

### Image Processing Options
- **Compression Quality**: 10-100% quality settings
- **Target File Size**: Specific KB/MB targets
- **Resize Dimensions**: Custom width/height
- **Output Formats**: JPG, PNG, WebP
- **Metadata Removal**: Strip EXIF/GPS data

### PDF Options
- **Page Sizes**: A4, Letter, Legal
- **Orientation**: Portrait or Landscape
- **Margins**: Customizable page margins
- **Image Quality**: Compression for PDF images

### PDF Compression Options
- **Quality Control**: 10-100% quality settings for compression
- **Target File Size**: Compress to specific KB/MB targets
- **Metadata Removal**: Strip document metadata for privacy
- **Image Optimization**: Optimize embedded images for better compression

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Docker (Recommended)
1. Start the application stack:
   ```bash
   docker compose up -d
   ```

2. Access the application at `http://localhost:3000`

3. To stop the application:
   ```bash
   docker compose down
   ```

## 🧪 Testing

Run the development server and test the following:

1. **File Upload**: Drag & drop various image formats
2. **Processing**: Test each operation type
3. **Size Estimation**: Verify compression predictions
4. **Download**: Test individual and batch downloads
5. **Error Handling**: Test with invalid files and large uploads

## 📄 API Endpoints

- `POST /api/process` - Process uploaded images
- `GET /api/download/[filename]` - Download processed file
- `GET /api/download-all` - Download ZIP of all files
- `GET /api/preview/[filename]` - Preview processed file
- `POST /api/estimate` - Estimate processing results
- `GET /api/cleanup` - List current processed files
- `DELETE /api/cleanup` - Clean up all processed files (with optional `?olderThan=hours` parameter)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@fileconverter.com or create an issue in the GitHub repository.

## 🙏 Acknowledgments

- Sharp library for high-performance image processing
- pdf-lib for PDF generation capabilities
- Tailwind CSS for beautiful, responsive design
- Next.js team for the excellent framework
