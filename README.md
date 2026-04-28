# NorthPath

AI-powered resume builder that helps craft tailored, job-specific resumes.

## Features

- **Resume Builder** – Structured step-by-step editor with real-time preview
- **AI Calibration** – Match your resume to job descriptions using LLM analysis
- **Experience Transformer** – Rewrite bullet points to align with target roles
- **Job Writing Map** – Break down job requirements into actionable resume content
- **Version Management** – Save and compare multiple resume versions
- **Export** – Generate DOCX, PDF, and Markdown outputs
- **File Import** – Parse existing resumes from PDF and Word documents

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router)
- **UI:** [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **State:** [Zustand](https://github.com/pmndrs/zustand)
- **Charts:** [Recharts](https://recharts.org/)
- **Documents:** [docx](https://github.com/dolanmiu/docx), [html2canvas](https://html2canvas.hertzen.com/), [jsPDF](https://github.com/parallax/jsPDF), [mammoth](https://github.com/mwilliamson/mammoth.js), [pdfjs-dist](https://github.com/mozilla/pdf.js)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## License

MIT
