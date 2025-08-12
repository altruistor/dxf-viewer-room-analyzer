# DXF Viewer & Room Analyzer

A modern web application for importing, parsing, and displaying DXF (Drawing Exchange Format) files in the browser with advanced room detection capabilities.

## 🏠 Room Detection Features

This application includes intelligent room detection algorithms that can:
- **Detect enclosed rooms** from closed polylines
- **Analyze rectangular spaces** constructed from individual lines  
- **Identify circular/rounded rooms** from circles and arcs
- **Visual overlay** of detected rooms with numbering
- **Room statistics** including area calculations and dimensions

## 🚀 Features

- **DXF File Upload** - Drag & drop and file selection support
- **DXF Parsing** - Using dxf-parser library
- **Visual Rendering** - Drawing visualization on HTML5 Canvas
- **Intelligent Room Detection**:
  - 🏠 Automated room detection from closed polylines
  - � Rectangle analysis from individual lines
  - ⭕ Circular room detection
  - 🎯 Advanced geometry-based algorithms
  - 📊 Room statistics and measurements
- **Drawing Navigation**:
  - �🔍 Zoom (buttons, mouse wheel, +/- keys)
  - 🖱️ Pan (mouse drag, buttons, arrows/WASD)
  - 🏠 Reset view (reset button, 0 key)
- **Layer Management** - Toggle visibility of individual layers
- **Content Viewing** - Display headers, entities, and blocks
- **Responsive Design** - Works on mobile devices and tablets
- **Error Handling** - Informative error messages

## 🛠️ Technology Stack

- **React 18** - Modern UI framework
- **TypeScript** - Type safety and code reliability
- **Vite** - Fast build tool and development server
- **dxf-parser** - DXF file parsing library
- **HTML5 Canvas** - High-performance 2D rendering
- **CSS3** - Modern styling and animations

## 📦 Installation and Setup

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173)

### Production Build

```bash
npm run build
```

### Preview Build

```bash
npm run preview
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

This will build the project and deploy it to GitHub Pages automatically.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── FileUpload.tsx   # File upload component
│   ├── FileUpload.css   # Upload styling
│   ├── DXFCanvas.tsx    # Main DXF viewer and room analyzer
│   ├── DXFViewer.tsx    # DXF display component
│   └── DXFViewer.css    # Viewer styling
├── services/            # Business logic
│   └── dxfService.ts    # DXF handling service
├── types/               # TypeScript types
│   └── dxf.ts          # DXF data types
├── App.tsx             # Main component
├── App.css             # Application styles
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## 🔧 Usage

1. **File Upload**: Drag & drop a DXF file into the upload area or click to select
2. **Parsing**: The application automatically parses the uploaded file
3. **View Drawing**:
   - 🖼️ "Drawing View" tab - visual representation
   - 📋 "File Details" tab - technical information
4. **Room Analysis**:
   - Click the "🎯 Correct Algorithm" button to detect rooms
   - Detected rooms appear as red overlays with numbers
   - Use the "Room Analysis" panel to view room details
   - Click the 🎯 button next to any room to center the view on it
5. **Navigation**:
   - **Zoom**: Mouse wheel, 🔍+/🔍- buttons, +/- keys
   - **Pan**: Mouse drag, ⬆️⬇️⬅️➡️ buttons, arrow keys or WASD
   - **Reset View**: ⌂ button, 0 key or Home
6. **Layer Management**:
   - "📋 Layers" button opens the layer management panel
   - Checkboxes next to layer names toggle their visibility
   - "👁️ Show/Hide All" button controls all layers at once
   - Colored circles show each layer's color
7. **New File**: Use "Load Another File" button to work with a new DXF

### ⌨️ Keyboard Shortcuts

- **W, A, S, D** or **Arrow Keys** - pan around
- **+ / -** - zoom in/out
- **0** or **Home** - reset view

## 📝 Supported Formats

- `.dxf` - Drawing Exchange Format files
- Support for various DXF format versions

## 🚀 Roadmap

Development plans:

- [x] Visual DXF drawing rendering on Canvas
- [x] Drawing zoom and navigation
- [x] Layer visibility management
- [x] Intelligent room detection algorithms
- [x] Room analysis and statistics
- [ ] Measurement tools (distances, angles)
- [ ] Export to other formats (PNG, SVG, PDF)
- [ ] Large file support with virtualization
- [ ] Dark theme
- [ ] Cursor coordinate information
- [ ] Object search and highlighting
- [ ] Drawing printing

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License
