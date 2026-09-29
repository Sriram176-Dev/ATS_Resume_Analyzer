/**
 * Keyword extraction and matching.
 *
 * Design notes
 * - Matching is boundary-aware: "java" never matches inside "javascript", "ai" never
 *   matches inside "maintain", and "c++" / "c#" / "node.js" are handled explicitly.
 * - Skills are grouped with aliases, so "K8s" on a resume satisfies "Kubernetes" in a JD.
 * - Terms are weighted (technical > domain > soft > other) so the match score reflects
 *   what recruiters actually screen for.
 */

/* ------------------------------------------------------------------ */
/* Skill dictionary: [display name, [aliases...]]                      */
/* ------------------------------------------------------------------ */

const TECHNICAL = [
  // Languages
  ["JavaScript", ["js", "ecmascript", "es6"]], ["TypeScript", ["ts"]], ["Python"], ["Java"], ["C++", ["cpp"]], ["C#", ["csharp", "c sharp"]],
  ["Golang", ["go lang"]], ["Rust"], ["Swift"], ["Kotlin"], ["PHP"], ["Ruby"], ["Scala"], ["Perl"], ["R programming", ["r language"]], ["MATLAB"],
  ["Bash", ["shell scripting", "shell script"]], ["PowerShell"], ["SQL"], ["NoSQL"], ["GraphQL"], ["HTML"], ["CSS"], ["SASS", ["scss"]],
  // Frontend
  ["React", ["react.js", "reactjs"]], ["Angular", ["angularjs"]], ["Vue", ["vue.js", "vuejs"]], ["Svelte"], ["Next.js", ["nextjs"]], ["Nuxt", ["nuxt.js"]],
  ["Redux"], ["Tailwind CSS", ["tailwind"]], ["Bootstrap"], ["jQuery"], ["Webpack"], ["Vite"], ["Responsive design"], ["Accessibility", ["wcag", "a11y"]],
  // Backend
  ["Node.js", ["node", "nodejs"]], ["Express", ["express.js", "expressjs", "express js"]], ["Django"], ["Flask"], ["FastAPI"], ["Spring Boot", ["spring framework", "springboot"]], [".NET", ["dotnet", "asp.net"]],
  ["Ruby on Rails", ["rails"]], ["Laravel"], ["NestJS", ["nest.js"]], ["REST API", ["restful", "rest apis", "restful api", "restful apis"]], ["Microservices", ["microservice"]],
  ["gRPC"], ["WebSockets", ["websocket"]], ["OAuth", ["oauth2", "oauth 2.0"]], ["JWT", ["json web token", "json web tokens"]],
  // Data
  ["MongoDB", ["mongo"]], ["PostgreSQL", ["postgres"]], ["MySQL"], ["SQLite"], ["Redis"], ["Elasticsearch", ["elastic search"]], ["DynamoDB"], ["Cassandra"], ["Snowflake"],
  ["BigQuery"], ["Kafka", ["apache kafka"]], ["RabbitMQ"], ["Spark", ["apache spark", "pyspark"]], ["Hadoop"], ["Airflow", ["apache airflow"]], ["ETL"], ["Data warehousing", ["data warehouse"]],
  ["Data modeling", ["data modelling"]], ["Pandas"], ["NumPy"], ["scikit-learn", ["sklearn"]], ["TensorFlow"], ["PyTorch"], ["Keras"],
  ["Machine learning", ["ml"]], ["Deep learning"], ["NLP", ["natural language processing"]], ["Computer vision"], ["Generative AI", ["genai", "gen ai"]], ["LLM", ["llms", "large language model", "large language models"]],
  ["Artificial intelligence", ["ai"]], ["Data science"], ["Data analysis", ["data analytics"]], ["Statistics", ["statistical analysis"]], ["A/B testing", ["ab testing", "split testing"]],
  // Cloud / DevOps
  ["AWS", ["amazon web services"]], ["Azure", ["microsoft azure"]], ["Google Cloud", ["gcp", "google cloud platform"]], ["Docker"], ["Kubernetes", ["k8s"]], ["Terraform"], ["Ansible"],
  ["Jenkins"], ["GitHub Actions"], ["GitLab CI"], ["CI/CD", ["cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"]], ["DevOps"], ["SRE", ["site reliability"]],
  ["Linux", ["unix"]], ["Nginx"], ["Serverless"], ["Lambda", ["aws lambda"]], ["Prometheus"], ["Grafana"], ["Datadog"], ["Monitoring", ["observability"]],
  // Tools & practices
  ["Git"], ["GitHub"], ["GitLab"], ["Bitbucket"], ["Jira"], ["Confluence"], ["Postman"], ["Swagger", ["openapi"]], ["Unit testing", ["unit tests"]], ["Integration testing"],
  ["Test automation", ["automated testing"]], ["Jest"], ["Cypress"], ["Selenium"], ["TDD", ["test-driven development", "test driven development"]], ["Design patterns"],
  ["System design"], ["Object-oriented programming", ["oop", "object oriented programming"]], ["Data structures"], ["Algorithms"],
  ["Cybersecurity", ["information security", "infosec"]], ["Penetration testing", ["pentesting"]], ["Networking"], ["Android"], ["iOS"], ["React Native"], ["Flutter"],
];

const DOMAIN = [
  ["Agile", ["agile methodology", "agile methodologies"]], ["Scrum"], ["Kanban"], ["Project management"], ["Product management"], ["Roadmapping", ["product roadmap", "roadmap"]],
  ["Stakeholder management", ["stakeholder engagement", "stakeholders"]], ["Budgeting", ["budget management"]], ["Forecasting"], ["Financial modeling", ["financial modelling"]],
  ["Financial analysis"], ["Accounting"], ["GAAP"], ["Auditing", ["audit"]], ["Excel", ["microsoft excel", "advanced excel"]], ["Power BI", ["powerbi"]], ["Tableau"], ["Looker"],
  ["Google Analytics", ["ga4"]], ["SEO", ["search engine optimization"]], ["SEM", ["search engine marketing"]], ["Content marketing"], ["Email marketing"], ["Social media"],
  ["CRM"], ["Salesforce"], ["HubSpot"], ["SAP"], ["ERP"], ["B2B"], ["B2C"], ["SaaS"], ["Lead generation"], ["Customer success"], ["Customer service", ["customer support"]],
  ["Sales", ["business development"]], ["Account management"], ["Negotiation"], ["Recruiting", ["talent acquisition"]], ["Onboarding"], ["Payroll"], ["Compliance"], ["Risk management"],
  ["Supply chain"], ["Logistics"], ["Procurement"], ["Operations"], ["Process improvement", ["process optimization", "six sigma"]], ["Quality assurance", ["qa"]],
  ["UX design", ["user experience", "ux"]], ["UI design", ["user interface", "ui"]], ["UX research", ["user research"]], ["Wireframing", ["wireframes"]], ["Prototyping", ["prototypes"]],
  ["Figma"], ["Adobe Photoshop", ["photoshop"]], ["Adobe Illustrator", ["illustrator"]], ["Copywriting"], ["Technical writing"], ["Data visualization", ["data visualisation"]],
  ["Cross-functional collaboration", ["cross-functional", "cross functional"]], ["KPIs", ["kpi", "key performance indicators"]], ["OKRs", ["okr"]], ["Reporting"],
];

const SOFT = [
  ["Communication", ["communicator", "communicating"]], ["Leadership"], ["Teamwork", ["team player", "collaboration", "collaborative"]], ["Problem-solving", ["problem solving"]],
  ["Critical thinking"], ["Analytical skills", ["analytical", "analytical thinking"]], ["Attention to detail", ["detail-oriented", "detail oriented"]], ["Time management"],
  ["Adaptability", ["adaptable", "flexibility"]], ["Creativity", ["creative"]], ["Initiative", ["self-starter", "proactive"]], ["Mentoring", ["mentorship", "coaching"]],
  ["Presentation skills", ["presentation", "presentations", "public speaking"]], ["Decision-making", ["decision making"]], ["Strategic thinking", ["strategic planning"]],
  ["Conflict resolution"], ["Prioritization", ["prioritisation"]], ["Ownership", ["accountability"]],
];

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Words that are also ordinary English: only match them when capitalised (e.g. "Swift", not "swift delivery"). */
const CASE_SENSITIVE = new Set(["Swift", "Rust", "Ruby", "Express", "Lambda", "Spark"]);

/**
 * Boundary-aware matcher that tolerates a trailing plural "s".
 * Case-insensitive unless the term is ambiguous with an English word.
 */
function termRegex(term, { caseSensitive = false } = {}) {
  const raw = caseSensitive ? term : term.toLowerCase();
  const escaped = escapeRegex(raw).replace(/\\?[\s-]+/g, "[\\s-]?");
  const body = caseSensitive ? `(?:${escaped}|${escapeRegex(term.toUpperCase())})` : escaped;
  const plural = /[a-z0-9]$/i.test(term) ? "(?:e?s)?" : "";
  // "." is excluded before a term so ".js" inside "Node.js" is not read as "JS".
  return new RegExp(`(?<![a-z0-9+#.])${body}${plural}(?![a-z0-9+#])`, caseSensitive ? "" : "i");
}

const globalOf = (re) => new RegExp(re.source, re.flags.replace("g", "") + "g");

function countMatches(text, term) {
  return (text.match(globalOf(termRegex(term))) || []).length;
}

const buildEntries = (list, category, weight) =>
  list.map(([display, aliases = []]) => ({
    display,
    category,
    weight,
    patterns: [display, ...aliases].map((t) => termRegex(t, { caseSensitive: CASE_SENSITIVE.has(t) })),
    aliasTerms: [display, ...aliases],
  }));

const DICTIONARY = [...buildEntries(TECHNICAL, "technical", 3), ...buildEntries(DOMAIN, "domain", 2), ...buildEntries(SOFT, "soft", 1)];

const STOP_WORDS = new Set(
  (
    "a about above across after again against all also although always am among an and any are around as at be because been before being below between both but by can could did do does doing down during each either else etc even ever every few for from further had has have having he her here hers him his how however i if in into is it its just like made make many may me might more most much must my need needs no nor not now of off on once one only or other our out over own per same shall she should since so some such than that the their them then there these they this those through to too under until up us use used using very via was we were what when where whether which while who whom why will with within without would you your yours " +
    "engineer engineers developer developers software engineering development technology technologies technical systems system solutions solution business environment environments support ensure ensuring help provide providing understanding knowledge ability able apply applicant applicants application benefits candidate candidates company companies description duties equal eligible employer employment excellent experience experiences expected familiarity good great highly ideal include includes including join looking must opportunity paid plus position preferred qualifications required requirements responsibilities responsible role roles salary seeking skills strong successful team teams time united work working years year etc full part remote hybrid onsite location degree bachelor bachelors master masters related similar relevant minimum least new well "
  ).split(/\s+/)
);

/** Light stemmer so "developing", "developed" and "developers" compare equal. */
function stem(word) {
  let w = word.toLowerCase();
  if (w.length <= 4) return w;
  w = w.replace(/(ies)$/, "y").replace(/(ing|ers|er|ed|es|s)$/, "");
  return w.length >= 3 ? w : word.toLowerCase();
}

const ACRONYM_EXCLUDE = new Set(["US", "USA", "UK", "EU", "EEO", "AM", "PM", "OK", "FAQ", "ETC", "CEO", "CFO", "COO", "PDF", "FTE", "PTO", "LLC", "INC", "LTD", "USD", "INR", "EST", "PST", "IST", "ASAP", "FYI", "PHD", "MBA", "II", "III", "IV"]);

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Extract the keywords a job description asks for.
 *
 * @param {string} jobDescription
 * @returns {{ term: string, category: "technical"|"domain"|"soft"|"other", weight: number, count: number }[]}
 */
export function extractKeywords(jobDescription) {
  if (!jobDescription || !jobDescription.trim()) return [];

  const jd = jobDescription;
  const found = [];
  const claimed = new Set();

  // 1. Dictionary skills
  for (const entry of DICTIONARY) {
    const count = entry.patterns.reduce((n, re) => n + (jd.match(globalOf(re)) || []).length, 0);
    if (count > 0) {
      found.push({ term: entry.display, category: entry.category, weight: entry.weight, count });
      entry.aliasTerms.forEach((a) => claimed.add(a.toLowerCase()));
    }
  }

  const claimedTokens = new Set([...claimed].flatMap((t) => t.split(/[\s/.-]+/)));

  // 2. Acronyms / tool names written in capitals that the dictionary doesn't know (e.g. "SOX", "EMR")
  const acronyms = new Map();
  for (const m of jd.matchAll(/\b[A-Z][A-Z0-9&]{1,9}\b/g)) {
    const token = m[0];
    if (ACRONYM_EXCLUDE.has(token) || claimed.has(token.toLowerCase()) || claimedTokens.has(token.toLowerCase()) || /^\d+$/.test(token)) continue;
    acronyms.set(token, (acronyms.get(token) || 0) + 1);
  }
  for (const [term, count] of acronyms) {
    found.push({ term, category: "other", weight: 2, count });
    claimed.add(term.toLowerCase());
  }

  // 3. Frequently repeated meaningful words (the JD's own emphasis)
  const freq = new Map();
  const words = jd.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) || [];
  for (const raw of words) {
    const word = raw.replace(/[.-]+$/, "");
    if (word.length < 4 || STOP_WORDS.has(word) || claimed.has(word)) continue;
    const key = stem(word);
    const prev = freq.get(key) || { word, count: 0 };
    prev.count += 1;
    freq.set(key, prev);
  }
  const emphasized = [...freq.values()]
    .filter((f) => f.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  for (const { word, count } of emphasized) {
    // Skip if already covered by a dictionary alias (e.g. "engineers" when "Engineering"...) or duplicates
    if (found.some((f) => f.term.toLowerCase() === word)) continue;
    found.push({ term: word, category: "other", weight: 1, count });
  }

  return found.sort((a, b) => b.weight - a.weight || b.count - a.count).slice(0, 40);
}

/**
 * Compare JD keywords against resume text.
 *
 * @param {string} resumeText
 * @param {ReturnType<typeof extractKeywords>} keywords
 * @returns {{
 *   details: { term: string, category: string, weight: number, matched: boolean }[],
 *   matched: string[], missing: string[],
 *   matchPercentage: number
 * }}
 */
export function compareKeywords(resumeText, keywords) {
  if (!keywords || keywords.length === 0) {
    return { details: [], matched: [], missing: [], matchPercentage: 0 };
  }

  const resumeStems = new Set((resumeText.toLowerCase().match(/[a-z][a-z0-9+#.-]*/g) || []).map((w) => stem(w.replace(/[.-]+$/, ""))));

  const details = keywords.map((k) => {
    const entry = DICTIONARY.find((e) => e.display === k.term);
    let matched;
    if (entry) {
      matched = entry.patterns.some((re) => re.test(resumeText));
    } else if (/^[A-Z0-9&]{2,10}$/.test(k.term)) {
      matched = termRegex(k.term).test(resumeText);
    } else {
      matched = resumeStems.has(stem(k.term));
    }
    return { term: k.term, category: k.category, weight: k.weight, matched };
  });

  const totalWeight = details.reduce((n, d) => n + d.weight, 0);
  const matchedWeight = details.filter((d) => d.matched).reduce((n, d) => n + d.weight, 0);

  return {
    details,
    matched: details.filter((d) => d.matched).map((d) => d.term),
    missing: details.filter((d) => !d.matched).map((d) => d.term),
    matchPercentage: totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0,
  };
}

export { countMatches, termRegex, stem };
