/**
 * Web app entry point
 */

/**
 * Serve Mini App HTML
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('TaskMini')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
