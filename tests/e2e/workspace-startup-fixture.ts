import type { Page } from '@playwright/test';

const hash = 'a'.repeat(64);
const createdAt = '2026-11-12T10:30:00Z';

function pdfFixture() {
  const stream = 'BT /F1 18 Tf 20 30 Td (Startup PDF) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 60] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = ['0000000000 65535 f \n'];
  for (const [index, object] of objects.entries()) {
    offsets.push(`${String(pdf.length).padStart(10, '0')} 00000 n \n`);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n${offsets.join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function installWorkspaceStartupMock(
  page: Page,
  revisionId = 100,
  revisionNumber = revisionId - 99,
) {
  const expiresAt = new Date(Date.now() + 600_000).toISOString();
  const accepted = {
    id: 900,
    projectId: 1,
    revisionId,
    proposalId: null,
    candidateVersion: null,
    candidateSnapshotId: null,
    status: 'succeeded',
    errorCode: null,
    inputManifestHash: hash,
    compilerFingerprint: hash,
    isCurrent: true,
    artifactAvailable: true,
    artifactExpiresAt: expiresAt,
    diagnostics: [],
    createdAt,
    startedAt: createdAt,
    finishedAt: createdAt,
  };
  await page.route('**/api/projects/1/compilations/latest-pdf', (route) =>
    route.fulfill({ json: { job: accepted, revisionNumber } }),
  );
  let nextJobId = 901;
  await page.route('**/api/projects/1/compilations', (route) =>
    route.fulfill({
      status: 202,
      json: { ...accepted, id: nextJobId++, revisionId: route.request().postDataJSON().revisionId },
    }),
  );
  await page.route(/\/api\/projects\/1\/compilations\/9\d{2}\/pdf$/, (route) =>
    route.fulfill({ contentType: 'application/pdf', body: pdfFixture() }),
  );
}
