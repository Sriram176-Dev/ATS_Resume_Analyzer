import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { extractKeywords, compareKeywords } from "../utils/keywordExtractor.js";
import { SAMPLE_JD } from "./helpers.js";

const terms = (jd) => extractKeywords(jd).map((k) => k.term);

test("does not match short terms inside longer words (regression: 'ai' in 'maintain')", () => {
  const found = terms("We maintain good email hygiene, take an interest in Google tools and rest assured");
  assert.deepEqual(found, []);
});

test("Java is not satisfied by JavaScript, SQL is not satisfied by MySQL", () => {
  const result = compareKeywords("Expert in JavaScript and MySQL", extractKeywords("Java and SQL required"));
  assert.deepEqual(result.missing.sort(), ["Java", "SQL"]);
});

test("'Node.js' does not also produce a 'JavaScript' keyword", () => {
  assert.deepEqual(terms("We use Node.js daily"), ["Node.js"]);
});

test("aliases are treated as equivalent (K8s = Kubernetes, postgres = PostgreSQL)", () => {
  const result = compareKeywords("Ran K8s clusters backed by postgres and reactjs", extractKeywords("Kubernetes, PostgreSQL, React"));
  assert.deepEqual(result.missing, []);
  assert.equal(result.matchPercentage, 100);
});

test("symbol terms C++, C# and .NET are extracted", () => {
  assert.deepEqual(terms("C++ and C# developers, .NET").sort(), [".NET", "C#", "C++"].sort());
});

test("ambiguous words only match when capitalised (Swift, Express)", () => {
  assert.deepEqual(terms("We deliver swift results and express interest"), []);
  assert.deepEqual(terms("Swift and Express experience").sort(), ["Express", "Swift"]);
});

test("'Spring 2023' on a resume does not satisfy 'Spring Boot'", () => {
  assert.deepEqual(compareKeywords("Intern, Spring 2023", extractKeywords("Spring Boot required")).missing, ["Spring Boot"]);
});

test("compound terms are not split into fragments (CI/CD, REST API)", () => {
  const found = terms("Experience with CI/CD and REST API design");
  assert.ok(found.includes("CI/CD") && found.includes("REST API"));
  assert.ok(!found.includes("CI") && !found.includes("CD") && !found.includes("REST"));
});

test("weighted match percentage favours technical terms", () => {
  const kws = extractKeywords("React and communication");
  const onlySoft = compareKeywords("Great communication", kws);
  const onlyTech = compareKeywords("Built things in React", kws);
  assert.ok(onlyTech.matchPercentage > onlySoft.matchPercentage);
});

test("empty job description yields no keywords", () => {
  assert.deepEqual(extractKeywords("   "), []);
  assert.equal(compareKeywords("anything", []).matchPercentage, 0);
});

test("realistic job description extracts the expected stack", () => {
  const found = terms(SAMPLE_JD);
  for (const t of ["React", "TypeScript", "Node.js", "PostgreSQL", "MongoDB", "Docker", "Kubernetes", "AWS", "Terraform", "GraphQL", "CI/CD"]) {
    assert.ok(found.includes(t), `expected ${t} in ${found.join(", ")}`);
  }
});
