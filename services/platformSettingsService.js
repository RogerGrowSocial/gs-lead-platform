/**
 * Platform settings service stub so admin.js loads when full platform settings are not deployed.
 */
async function getRbacMatrix() {
  return { roles: [], sections: [], bySection: {} }
}

module.exports = { getRbacMatrix }
