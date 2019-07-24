
exports.validate = ({ config }) => {
  if (!config.auth.superAdminEmail) {
    throw new Error('Missing super admin email. Use env: SUPER_ADMIN_EMAIL')
  }
}
