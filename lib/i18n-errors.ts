import type { Locale } from "./i18n";

const messages: ReadonlyArray<readonly [string, string]> = [
  ["요청 출처를 확인할 수 없습니다.", "The request origin could not be verified."],
  ["올바른 형식으로 요청해주세요.", "Please use the correct request format."],
  ["입력 내용이 너무 깁니다.", "The input is too long."],
  ["입력 내용을 확인해주세요.", "Please check your input."],
  ["요청을 처리하지 못했습니다.", "The request could not be processed."],
  ["요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", "The request could not be processed. Please try again shortly."],
  ["연결이 끊겼습니다. 저장 여부를 새로고침으로 확인한 뒤 다시 시도해주세요.", "The connection was lost. Refresh to check whether your changes were saved before trying again."],
  ["요청한 경로를 찾을 수 없습니다.", "The requested endpoint could not be found."],
  ["논문을 찾을 수 없습니다.", "The paper could not be found."],
  ["논문 제목을 입력해주세요.", "Please enter the paper title."],
  ["올바른 발표일을 입력해주세요.", "Please enter a valid presentation date."],
  ["http 또는 https 원문 링크를 입력해주세요.", "Please enter an http or https link to the original paper."],
  ["참고 링크의 이름과 URL을 모두 입력해주세요.", "Please enter both a name and a URL for each reference link."],
  ["http 또는 https 참고 링크를 입력해주세요.", "Please enter an http or https reference link without sign-in credentials."],
  ["토론 내용을 입력해주세요.", "Please enter a discussion comment."],
  ["논문 버전을 확인해주세요.", "Please check the paper version."],
  ["논문이 변경되었습니다. 새로고침 후 다시 시도해주세요.", "The paper has changed. Refresh the page and try again."],
  ["논문이 변경되었습니다. 새로고침 후 다시 확인해주세요.", "The paper has changed. Refresh the page and check again."],
  ["다른 곳에서 논문이 변경되었습니다. 새로고침 후 다시 확인해주세요.", "The paper was changed elsewhere. Refresh the page and check again."],
  ["첨부된 PDF가 없습니다.", "No PDF is attached."],
  ["PDF 파일을 선택해주세요.", "Please select a PDF file."],
  ["업로드할 파일이 없습니다.", "There is no file to upload."],
  ["파일 업로드 형식을 확인해주세요.", "Please check the file upload format."],
  ["PDF 파일 한 개를 선택해주세요.", "Please select one PDF file."],
  ["PDF 형식의 파일만 업로드할 수 있습니다.", "Only PDF files can be uploaded."],
  ["올바른 PDF 파일이 아닙니다.", "This is not a valid PDF file."],
  ["비어 있는 PDF 파일은 사용할 수 없습니다.", "Empty PDF files cannot be used."],
  ["PDF 파일 크기를 확인해주세요.", "Please check the PDF file size."],
  ["PDF 파일 크기가 허용 범위를 초과합니다.", "The PDF file exceeds the allowed size."],
  ["다른 PDF를 처리하고 있습니다. 잠시 후 다시 시도해주세요.", "Other PDFs are being processed. Please try again shortly."],
  ["PDF 처리 시간이 초과되었습니다. 파일을 확인한 뒤 다시 시도해주세요.", "PDF processing timed out. Check the file and try again."],
  ["PDF 내용을 읽지 못했습니다.", "The PDF contents could not be read."],
  ["암호가 필요한 PDF입니다. 암호를 해제한 파일을 업로드해주세요.", "This PDF requires a password. Remove the password before uploading it."],
  ["PDF 내용을 읽지 못했습니다. 손상되지 않은 파일인지 확인해주세요.", "The PDF contents could not be read. Please check that the file is not damaged."],
  ["PDF를 처리하지 못했습니다. 다른 파일로 다시 시도해주세요.", "The PDF could not be processed. Please try another file."],
  ["PDF 처리가 중단되었습니다.", "PDF processing was interrupted."],
  ["PDF 저장소 연결이 설정되지 않았습니다.", "PDF storage has not been configured."],
  ["PDF 파일 정보를 확인해주세요.", "Please check the PDF file details."],
  ["PDF 업로드 정보를 확인해주세요.", "Please check the PDF upload details."],
  ["PDF 업로드 시간이 만료되었습니다. 파일을 다시 선택해주세요.", "The PDF upload has expired. Please select the file again."],
  ["업로드한 PDF의 크기가 일치하지 않습니다. 파일을 다시 선택해주세요.", "The uploaded PDF size does not match. Please select the file again."],
  ["이미 저장된 PDF 파일입니다.", "This PDF has already been saved."],
  ["PDF를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.", "The PDF could not be saved. Please try again shortly."],
  ["PDF 파일을 정리하지 못했습니다. 잠시 후 다시 시도해주세요.", "The PDF files could not be cleaned up. Please try again shortly."],
  ["PDF 업로드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.", "The PDF upload could not be prepared. Please try again shortly."],
  ["PDF 업로드를 준비하지 못했습니다. 다시 시도해주세요.", "The PDF upload could not be prepared. Please try again."],
  ["PDF 파일을 업로드하지 못했습니다. 다시 시도해주세요.", "The PDF file could not be uploaded. Please try again."],
  ["PDF 다운로드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.", "The PDF download could not be prepared. Please try again shortly."],
  ["PDF 파일을 찾을 수 없습니다.", "The PDF file could not be found."],
  ["PDF 파일을 불러오지 못했습니다. 파일 업로드 후 다시 시도해주세요.", "The PDF file could not be loaded. Upload the file and try again."],
  ["PDF 파일을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "The PDF file could not be loaded. Please try again shortly."],
  ["데이터베이스 연결 설정을 확인해주세요.", "Please check the database connection settings."],
  ["데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", "The database could not be reached. Please try again shortly."],
  ["데이터베이스 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.", "The database response could not be read. Please try again shortly."],
  ["이미 처리된 자료입니다. 새로고침 후 확인해주세요.", "This item has already been processed. Refresh the page to check it."],
  ["저장할 논문과 PDF 정보를 확인해주세요.", "Please check the paper and PDF details to be saved."],
  ["데이터베이스 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", "The database request could not be processed. Please try again shortly."],
  ["AI 요약이 아직 연결되지 않았습니다. 직접 내용을 정리해주세요.", "AI summarization is not connected yet. Please write the notes yourself."],
  ["요약할 본문을 충분히 추출하지 못했습니다. 텍스트를 선택할 수 있는 PDF를 사용해주세요.", "Not enough text could be extracted for a summary. Please use a PDF with selectable text."],
  ["이 PDF의 AI 요약이 진행 중입니다. 완료된 뒤 다시 시도해주세요.", "An AI summary is already being generated for this PDF. Please wait for it to finish."],
  ["완성된 요약을 받지 못했습니다. 잠시 후 다시 시도해주세요.", "A complete summary could not be received. Please try again shortly."],
  ["요약 형식이 올바르지 않습니다. 다시 생성해주세요.", "The summary format is invalid. Please generate it again."],
  ["요약의 내용 또는 근거 페이지를 확인하지 못했습니다. 다시 생성해주세요.", "The summary content or supporting pages could not be verified. Please generate it again."],
  ["AI 요약 시간이 초과되었거나 요청이 취소되었습니다.", "AI summarization timed out or the request was cancelled."],
  ["AI 서비스 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.", "The AI service usage limit has been reached. Please try again shortly."],
  ["AI 요약을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.", "The AI summary could not be generated. Please try again shortly."],
  ["먼저 PDF를 업로드해주세요.", "Please upload a PDF first."],
  ["PDF가 변경되었습니다. 새로고침 후 다시 시도해주세요.", "The PDF has changed. Refresh the page and try again."],
  ["요약 중 PDF가 변경되었습니다. 새 파일로 다시 생성해주세요.", "The PDF changed during summarization. Please generate a summary of the new file."],
];

export function translateError(message: string, locale: Locale): string {
  const translated = messages.find(([ko, en]) => message === ko || message === en);
  if (translated) return translated[locale === "ko" ? 0 : 1];

  const linkCount = message.match(/^참고 링크는 (\d+)개까지 추가할 수 있습니다\.$/) ?? message.match(/^You can add up to (\d+) reference links\.$/);
  if (linkCount) return locale === "ko" ? `참고 링크는 ${linkCount[1]}개까지 추가할 수 있습니다.` : `You can add up to ${linkCount[1]} reference links.`;

  const uploadSize = message.match(/^PDF는 ([\d.]+)MB 이하로 업로드해주세요\.$/) ?? message.match(/^Please upload a PDF no larger than ([\d.]+)MB\.$/);
  if (uploadSize) return locale === "ko" ? `PDF는 ${uploadSize[1]}MB 이하로 업로드해주세요.` : `Please upload a PDF no larger than ${uploadSize[1]}MB.`;

  const fileSize = message.match(/^비어 있지 않은 ([\d.]+)MB 이하의 PDF를 선택해주세요\.$/) ?? message.match(/^Please select a non-empty PDF no larger than ([\d.]+)MB\.$/);
  if (fileSize) return locale === "ko" ? `비어 있지 않은 ${fileSize[1]}MB 이하의 PDF를 선택해주세요.` : `Please select a non-empty PDF no larger than ${fileSize[1]}MB.`;

  const pageCount = message.match(/^([\d,]+)쪽 이하의 PDF를 업로드해주세요\.$/) ?? message.match(/^Please upload a PDF with no more than ([\d,]+) pages\.$/);
  if (pageCount) return locale === "ko" ? `${pageCount[1]}쪽 이하의 PDF를 업로드해주세요.` : `Please upload a PDF with no more than ${pageCount[1]} pages.`;

  const noteLength = message.match(/^각 정리는 ([\d,]+)자 이내로 작성해주세요\.$/) ?? message.match(/^Keep each note within ([\d,]+) characters\.$/);
  if (noteLength) return locale === "ko" ? `각 정리는 ${noteLength[1]}자 이내로 작성해주세요.` : `Keep each note within ${noteLength[1]} characters.`;

  const textLengthKo = message.match(/^추출한 본문이 너무 깁니다\. ([\d.]+)만 자 이하의 문서를 사용해주세요\.$/);
  const textLengthEn = message.match(/^The extracted text is too long\. Use a document with no more than (\d+) characters\.$/);
  if (textLengthKo || textLengthEn) {
    const limit = textLengthKo ? Number(textLengthKo[1]) * 10000 : Number(textLengthEn![1]);
    return locale === "ko" ? `추출한 본문이 너무 깁니다. ${limit / 10000}만 자 이하의 문서를 사용해주세요.` : `The extracted text is too long. Use a document with no more than ${limit} characters.`;
  }

  const fieldLength = message.match(/^Too big: expected string to have <=([\d,]+) characters$/) ?? message.match(/^([\d,]+)자 이내로 작성해주세요\.$/) ?? message.match(/^Use no more than ([\d,]+) characters\.$/);
  if (fieldLength) return locale === "ko" ? `${fieldLength[1]}자 이내로 작성해주세요.` : `Use no more than ${fieldLength[1]} characters.`;

  if (/^(?:Invalid input|Invalid option|Invalid UUID|Too big:|Too small:|Unrecognized keys?:)/.test(message)) {
    return locale === "ko" ? "입력 내용을 확인해주세요." : "Please check your input.";
  }
  return message;
}
