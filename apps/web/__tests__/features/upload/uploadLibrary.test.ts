import {
  fileProblem,
  linkProblem,
  MAX_FILE_BYTES,
  looksLikeLink,
} from '@/features/upload/uploadLibrary';

describe('uploadLibrary', () => {
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

  it('tells a single link from a pasted description', () => {
    expect(looksLikeLink(' https://example.com/jobs/1 ')).toBe(true);
    expect(looksLikeLink('Senior designer at https://example.com')).toBe(false);
  });
});
