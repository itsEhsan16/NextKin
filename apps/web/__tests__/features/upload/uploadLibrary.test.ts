import {
  fileProblem,
  isUploadTab,
  linkProblem,
  MAX_FILE_BYTES,
  skillSummary,
} from '@/features/upload/uploadLibrary';

describe('uploadLibrary', () => {
  it('knows its three tabs', () => {
    expect(['file', 'link', 'paste'].every(isUploadTab)).toBe(true);
    expect(isUploadTab('docs')).toBe(false);
  });

  it('takes the board’s four formats up to 5MB', () => {
    for (const name of ['jd.pdf', 'jd.DOC', 'jd.docx', 'jd.txt']) {
      expect(fileProblem({ name, size: 1000 })).toBeNull();
    }
    expect(fileProblem({ name: 'jd.pdf', size: MAX_FILE_BYTES })).toBeNull();
    expect(fileProblem({ name: 'jd.pdf', size: MAX_FILE_BYTES + 1 })).toBe(
      'That file is over 5MB. Upload a smaller one.',
    );
    expect(fileProblem({ name: 'jd.pdf', size: 0 })).toBe(
      'That file is empty. Choose another one.',
    );
    expect(fileProblem({ name: 'jd', size: 10 })).toMatch(/isn’t supported/);
    expect(fileProblem({ name: 'jd.png', size: 10 })).toMatch(/isn’t supported/);
  });

  it('wants a full http(s) link', () => {
    expect(linkProblem('https://www.linkedin.com/jobs/view/1')).toBeNull();
    expect(linkProblem('  http://careers.example.com/role  ')).toBeNull();
    expect(linkProblem('www.linkedin.com/jobs')).not.toBeNull();
    expect(linkProblem('ftp://example.com/jd')).not.toBeNull();
    expect(linkProblem('https://localhost/jd')).not.toBeNull();
  });

  it('counts the skills a draft found', () => {
    expect(skillSummary({ requiredSkills: ['Figma', 'SQL'], preferredSkills: ['WCAG'] })).toBe(
      'found 3 skills: 2 required, 1 preferred',
    );
    expect(skillSummary({ requiredSkills: ['Figma'], preferredSkills: [] })).toBe(
      'found 1 skill: 1 required, 0 preferred',
    );
    expect(skillSummary({ requiredSkills: [], preferredSkills: [] })).toBe(
      'didn’t recognise any skills in it',
    );
  });
});
