// quick manual test — run with: node test-library-check.js
const extractLibraryVersions = require("../server/utils/checks/libraryCheck.js");

const testHtml = `
  <html><body>
    <script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.3.1/js/bootstrap.min.js"></script>
    <script>/*! Lodash Version 4.17.19 */ var _ = {};</script>
  </body></html>
`;

console.log(extractLibraryVersions(testHtml));
