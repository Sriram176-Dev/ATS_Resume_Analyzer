import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun } from "docx";

export const SAMPLE_RESUME_LINES = {
  header: ["Priya Sharma", "priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priyasharma | github.com/priya"],
  sections: [
    { title: "SUMMARY", body: ["Full-stack engineer with 4+ years of experience building React and Node.js applications."] },
    {
      title: "EXPERIENCE",
      body: [
        "Senior Software Engineer, Acme Corp (2022 - Present)",
        "• Led a team of 5 engineers to deliver a React dashboard, cutting page load time by 42%.",
        "• Designed REST APIs in Node.js and MongoDB serving 2M requests per day.",
        "• Implemented CI/CD pipelines with Docker and GitHub Actions, reducing release time by 60%.",
        "• Mentored 3 junior developers and improved test coverage from 40% to 85%.",
        "Software Engineer, Beta Labs (2020 - 2022)",
        "• Built an analytics service in Python that processed $1.2M in monthly transactions.",
        "• Optimized SQL queries, improving report generation speed by 3x.",
      ],
    },
    { title: "EDUCATION", body: ["B.Tech in Computer Science, JNTU Hyderabad (2016 - 2020)"] },
    { title: "SKILLS", body: ["JavaScript, TypeScript, React, Node.js, Express, MongoDB, PostgreSQL, Docker, AWS, Git, Agile"] },
  ],
};

/** Build a small text-based PDF (multi-line, with bullets) in memory. */
export function makePdf(lines = null) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (lines) {
      lines.forEach((l) => doc.fontSize(11).text(l));
    } else {
      const { header, sections } = SAMPLE_RESUME_LINES;
      doc.fontSize(20).text(header[0]);
      doc.fontSize(10).text(header[1]).moveDown();
      for (const s of sections) {
        doc.fontSize(13).text(s.title).moveDown(0.2);
        s.body.forEach((l) => doc.fontSize(10.5).text(l));
        doc.moveDown();
      }
    }
    doc.end();
  });
}

/** Build a DOCX with real list items. */
export async function makeDocx() {
  const { header, sections } = SAMPLE_RESUME_LINES;
  const children = [new Paragraph({ children: [new TextRun({ text: header[0], bold: true, size: 36 })] }), new Paragraph(header[1])];
  for (const s of sections) {
    children.push(new Paragraph({ children: [new TextRun({ text: s.title, bold: true })] }));
    for (const line of s.body) {
      if (line.startsWith("• ")) children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
      else children.push(new Paragraph(line));
    }
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export const SAMPLE_JD = `Senior Full Stack Engineer
We are looking for an engineer with strong experience in React, TypeScript and Node.js.
You will design REST APIs, work with PostgreSQL and MongoDB, and deploy with Docker and Kubernetes on AWS.
Experience with CI/CD, GraphQL and Terraform is a plus. Strong communication and leadership skills required.
You will mentor engineers and collaborate cross-functionally in an Agile team.`;
