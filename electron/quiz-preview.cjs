// Only student-visible fields are previewed; never stream answer keys.
function quizPreview(text) {
  const parts = [];
  for (const match of text.matchAll(
    /"(passage|question)"\s*:\s*("(?:[^"\\]|\\.)*")/g,
  )) {
    try {
      parts.push(JSON.parse(match[2]));
    } catch {
      /* wait for a complete string */
    }
  }
  const partial = text.match(
    /"(?:passage|question)"\s*:\s*("(?:[^"\\]|\\.)*)$/,
  );
  if (partial) {
    try {
      parts.push(JSON.parse(partial[1] + '"'));
    } catch {
      /* incomplete escape sequence */
    }
  }
  return parts.join("\n\n");
}
module.exports = { quizPreview };
