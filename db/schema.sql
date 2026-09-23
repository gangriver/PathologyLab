CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '', authors TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
  referenceLinks TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(referenceLinks) AND json_type(referenceLinks) = 'array'),
  researchQuestion TEXT NOT NULL DEFAULT '', methods TEXT NOT NULL DEFAULT '', findings TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '', meetingDate TEXT NOT NULL DEFAULT '', presenter TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('planned','discussed')) DEFAULT 'planned',
  createdBy TEXT NOT NULL DEFAULT '', creatorName TEXT NOT NULL DEFAULT '방문자',
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, paperId TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  authorId TEXT NOT NULL DEFAULT '', authorName TEXT NOT NULL DEFAULT '방문자', content TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_paper_idx ON comments(paperId,createdAt);
CREATE INDEX IF NOT EXISTS papers_meeting_idx ON papers(meetingDate,createdAt);
CREATE TABLE IF NOT EXISTS paper_documents (
  id TEXT NOT NULL UNIQUE, paperId TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, content BLOB NOT NULL, byteLength INTEGER NOT NULL,
  pagesJson TEXT NOT NULL, pageCount INTEGER NOT NULL, textCharacters INTEGER NOT NULL,
  uploadedBy TEXT NOT NULL DEFAULT '', uploadedAt TEXT NOT NULL
);
