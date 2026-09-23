import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGithubLinks, normalizeGithubRepositoryUrl } from "../lib/github-links";
import { REFERENCE_LINK_LIMITS } from "../lib/types";

test("GitHub 주소는 저장소 루트로 정규화하고 처음 표기를 유지", () => {
  for (const input of [
    "https://github.com/Lab/Model",
    "http://github.com/Lab/Model/",
    "github.com/Lab/Model.git",
    "www.github.com/Lab/Model/tree/main?tab=readme#examples",
    "HTTPS://WWW.GITHUB.COM/Lab/Model.GIT/issues/1",
    " https://github.com/Lab/Model). ",
    "https://github.com/Lab/Model，",
    "https://github.com/Lab/Mo\u200bdel",
  ]) assert.equal(normalizeGithubRepositoryUrl(input), "https://github.com/Lab/Model", input);
});

test("GitHub 호스트 이외 주소와 자격 증명, 포트, 스킴, 경로 조작은 제외", () => {
  for (const input of [
    "https://github.com.evil.test/Lab/Model",
    "https://notgithub.com/Lab/Model",
    "https://github.com@evil.test/Lab/Model",
    "https://user:password@github.com/Lab/Model",
    "https://github.com:443/Lab/Model",
    "http://github.com:80/Lab/Model",
    "https://evil.test/?url=https://github.com/Lab/Model",
    "javascript:https://github.com/Lab/Model",
    "ftp://github.com/Lab/Model",
    "//github.com/Lab/Model",
    "https://github.com/Lab/Model/../Other",
    "https://github.com/Lab/%2e%2e/Other",
    "https://github.com/Lab\\Model",
    "https://github.com/ Lab/Model",
    "https://github.com/Lab/Model\nName",
  ]) assert.equal(normalizeGithubRepositoryUrl(input), undefined, input);
});

test("프로필과 GitHub의 예약 경로를 저장소로 제안하지 않음", () => {
  for (const input of [
    "https://github.com/Lab", "https://github.com/Lab/",
    "https://github.com/orgs/Lab", "https://github.com/topics/pathology",
    "https://github.com/collections/machine-learning", "https://github.com/settings/profile",
    "https://github.com/features/copilot", "https://github.com/search?q=Lab/Model",
    "https://github.com/Lab/.git", "https://github.com/-Lab/Model",
  ]) assert.equal(normalizeGithubRepositoryUrl(input), undefined, input);
});

test("문장부호, 대소문자, .git와 하위 경로를 합쳐 페이지별 후보를 반환", () => {
  assert.deepEqual(extractGithubLinks([
    { pageNumber: 1, text: "Code: (https://github.com/Lab/Model). github.com/Lab/Model.git; www.github.com/Second/Tool/tree/main。" },
    { pageNumber: 2, text: "[https://GITHUB.com/lab/model/issues] <https://github.com/Lab/Model#readme>" },
  ]), [
    { label: "Lab/Model", url: "https://github.com/Lab/Model", pages: [1, 2] },
    { label: "Second/Tool", url: "https://github.com/Second/Tool", pages: [1] },
  ]);
});

test("PDF의 슬래시 경계 줄바꿈과 소프트 하이픈, 제로폭 문자를 복원", () => {
  assert.deepEqual(extractGithubLinks([
    { pageNumber: 1, text: "https://github.com/\nLab/\r\nModel github.com\n/Other\n/Tool" },
    { pageNumber: 2, text: "https://github.com/Lab/Mo\u00ad\ndel https://github.com/Other/To\u200bol" },
  ]), [
    { label: "Lab/Model", url: "https://github.com/Lab/Model", pages: [1, 2] },
    { label: "Other/Tool", url: "https://github.com/Other/Tool", pages: [1, 2] },
  ]);
});

test("일반 줄바꿈이나 공백으로 분리된 단어를 임의로 붙이지 않음", () => {
  const candidates = extractGithubLinks([{ pageNumber: 1, text: "https://github.com/Lab/Model\nResults github.com/Profile\nDiscussion https://github.com/Team/Some name" }]);
  assert.deepEqual(candidates.map(candidate => candidate.url), ["https://github.com/Lab/Model", "https://github.com/Team/Some"]);
});

test("다른 주소에 포함된 GitHub 및 가짜 도메인은 본문에서도 제외", () => {
  assert.deepEqual(extractGithubLinks([{ pageNumber: 1, text: [
    "https://evil.test/?url=https://github.com/Lab/Model",
    "https://github.com.evil.test/Lab/Model",
    "javascript:https://github.com/Lab/Model",
    "https://user@github.com/Lab/Model",
    "someone@github.com/Lab/Model",
    "https://github.com:443/Lab/Model",
    "https://github.com/orgs/Lab",
  ].join(" ") }]), []);
});

test("페이지와 본문 출현 순서로 정렬하며 입력을 바꾸지 않음", () => {
  const pages = [
    { pageNumber: 3, text: "https://github.com/A/First" },
    { pageNumber: 1, text: "https://github.com/B/Second https://github.com/A/First" },
    { pageNumber: 2, text: "https://github.com/C/Third" },
  ];
  assert.deepEqual(extractGithubLinks(pages), [
    { label: "B/Second", url: "https://github.com/B/Second", pages: [1] },
    { label: "A/First", url: "https://github.com/A/First", pages: [1, 3] },
    { label: "C/Third", url: "https://github.com/C/Third", pages: [2] },
  ]);
  assert.deepEqual(pages.map(page => page.pageNumber), [3, 1, 2]);
});

test("후보의 이름은 참고 링크 이름의 길이 제한을 준수", () => {
  const repository = "r".repeat(100);
  const [candidate] = extractGithubLinks([{ pageNumber: 1, text: `https://github.com/LongOrganization/${repository}` }]);
  assert.equal(candidate.label.length, REFERENCE_LINK_LIMITS.maxLabelLength);
  assert.equal(candidate.url, `https://github.com/LongOrganization/${repository}`);
});

test("본문, 페이지 또는 GitHub 저장소 주소가 없으면 빈 후보 반환", () => {
  assert.deepEqual(extractGithubLinks([]), []);
  assert.deepEqual(extractGithubLinks([{ pageNumber: 1, text: "" }, { pageNumber: 2, text: "No repository is provided. github.com/Lab" }]), []);
});
