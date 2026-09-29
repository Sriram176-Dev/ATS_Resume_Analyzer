import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import ScoreRing from "../../components/ui/ScoreRing";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import "./landing.css";

/** A static, clearly-labelled sample that shows what the parser "sees". */
function SampleReport() {
  let i = 0;
  const mark = (text) => <mark style={{ "--i": i++ }}>{text}</mark>;
  return (
    <figure className="sample" aria-label="Example analysis of a sample resume">
      <div className="sample-bar">
        <span className="sample-file">priya_sharma_resume.pdf</span>
        <span className="badge tone-neutral">Sample</span>
      </div>
      <div className="sample-body">
        <div className="sheet" aria-hidden="true">
          <p className="sheet-name">{mark("Priya Sharma")}</p>
          <p className="sheet-contact">{mark("priya@example.com")} &nbsp; {mark("+91 98765 43210")}</p>
          <p className="sheet-h">{mark("Experience")}</p>
          <p className="sheet-role">Senior Software Engineer, Acme Corp</p>
          <ul>
            <li>Led 5 engineers to ship a {mark("React")} dashboard, cutting load time by {mark("42%")}.</li>
            <li>Designed {mark("Node.js")} APIs serving {mark("2M")} requests a day.</li>
            <li>Automated releases with Docker and CI/CD, saving {mark("60%")} of deploy time.</li>
          </ul>
          <p className="sheet-h">{mark("Skills")}</p>
          <p>React, Node.js, MongoDB, PostgreSQL, Docker, AWS</p>
        </div>

        <div className="parsed">
          <div className="parsed-score">
            <ScoreRing score={86} size={104} stroke={9} />
            <div>
              <p className="parsed-title">What the ATS extracted</p>
              <p className="hint">Highlighted on the left</p>
            </div>
          </div>
          <ul className="parsed-list">
            <li><Check size={16} aria-hidden="true" />Name and contact details</li>
            <li><Check size={16} aria-hidden="true" />Experience and Skills sections</li>
            <li><Check size={16} aria-hidden="true" />4 quantified results</li>
            <li className="parsed-bad"><X size={16} aria-hidden="true" />No Education section found</li>
          </ul>
          <p className="parsed-kw"><span className="chip chip-missing">Kubernetes</span><span className="hint">in the job description, not on the resume</span></p>
        </div>
      </div>
    </figure>
  );
}

const SCORING = [
  { name: "Format", blurb: "Can software read and structure your resume?", items: ["Email, phone and profile link", "Standard Experience, Education and Skills headings", "Bullet points and dates on every role", "A sensible length of one to two pages", "Text that can actually be extracted from the file"] },
  { name: "Content", blurb: "Do the bullets show specific, measurable impact?", items: ["Bullets that open with strong action verbs", "Numbers, percentages and other results", "Weak phrases such as \"responsible for\"", "First-person language", "Bullet length and variety"] },
  { name: "Keywords", blurb: "Does your resume use the job description's language?", items: ["Skills and tools named in the posting", "Aliases understood, so K8s counts as Kubernetes", "Technical skills weighted above soft skills", "Exact-word matching: Java is not JavaScript"] },
];

const FAQ = [
  { q: "Is this the score my employer's ATS will give me?", a: "No. Every company configures its applicant tracking system differently, and none of them publish their scoring. ResumeATS checks the things nearly all of them depend on (can the text be read, are the standard sections there, do the keywords match) and gives you a transparent estimate, with the reason behind every point." },
  { q: "Which files work?", a: "PDF and Word (.docx). The PDF has to contain real text. If you exported a scan or a picture of a page, ATS software can't read it either, and we'll tell you so." },
  { q: "What happens to my resume?", a: "It's parsed on our server and the analysis is saved to your account so you can compare versions. You can delete any analysis at any time. When AI suggestions are switched on, the resume text is also sent to Google's Gemini API to write them." },
  { q: "Do I need a job description?", a: "No. Without one you get the format and content checks. Paste a posting to add keyword matching, which is usually where tailoring a resume pays off most." },
  { q: "Why is my keyword score low if I have the skills?", a: "The matcher looks for the posting's own wording. If it says \"Kubernetes\" and your resume says \"container orchestration\", add the exact term where it's true. Common aliases like K8s are understood." },
];

export default function Landing() {
  useDocumentTitle();
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>See your resume the way an ATS does.</h1>
            <p className="hero-lede">Upload a PDF or Word resume and get a score, a checklist of what parsers can and can't read, and specific fixes. Paste a job description to find the keywords you're missing.</p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-primary btn-lg">Analyze my resume</Link>
              <a href="#scoring" className="btn btn-ghost btn-lg">How the score works</a>
            </div>
            <p className="hint">Works with PDF and Word (.docx) files.</p>
          </div>
          <SampleReport />
        </div>
      </section>

      <section id="scoring" className="lp-section">
        <div className="container">
          <div className="lp-head">
            <h2>A score you can trace, point by point</h2>
            <p>No black box. Each report lists every check that ran, whether it passed, and what to change. Here's how the total is weighted.</p>
          </div>

          <div className="weights" role="img" aria-label="With a job description: keywords 40 percent, format 30 percent, content 30 percent. Without one: format 50 percent, content 50 percent.">
            <div className="weights-row"><span className="weights-label">With a job description</span>
              <div className="weights-bar"><span className="w-kw" style={{ flex: 40 }}>Keywords 40%</span><span className="w-fm" style={{ flex: 30 }}>Format 30%</span><span className="w-ct" style={{ flex: 30 }}>Content 30%</span></div></div>
            <div className="weights-row"><span className="weights-label">Without one</span>
              <div className="weights-bar"><span className="w-fm" style={{ flex: 50 }}>Format 50%</span><span className="w-ct" style={{ flex: 50 }}>Content 50%</span></div></div>
          </div>

          <div className="scoring-cols">
            {SCORING.map((s) => (
              <div key={s.name} className="scoring-col">
                <h3>{s.name}</h3>
                <p>{s.blurb}</p>
                <ul>{s.items.map((it) => <li key={it}><Check size={16} aria-hidden="true" />{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-alt">
        <div className="container steps-wrap">
          <div className="lp-head">
            <h2>From upload to a better resume in three steps</h2>
          </div>
          <ol className="steps">
            <li><span className="step-n" aria-hidden="true">1</span><div><h3>Upload</h3><p>Add your resume and, if you have one in mind, the job posting you're applying to.</p></div></li>
            <li><span className="step-n" aria-hidden="true">2</span><div><h3>Read the report</h3><p>See your score, the recommendations ranked by impact, and exactly which keywords are missing.</p></div></li>
            <li><span className="step-n" aria-hidden="true">3</span><div><h3>Fix and compare</h3><p>Update your resume, run it again, and watch your score history improve. Download any report as a PDF.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="lp-section">
        <div className="container faq-wrap">
          <div className="lp-head"><h2>Questions, answered plainly</h2></div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="container cta-band">
        <div className="cta-inner">
          <h2>Check your resume in under a minute.</h2>
          <Link to="/register" className="btn btn-primary btn-lg">Create an account</Link>
        </div>
      </section>
    </>
  );
}
