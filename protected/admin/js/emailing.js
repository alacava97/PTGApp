document.addEventListener('DOMContentLoaded', init);

async function init() {
    await requireAdmin();

    const { emails, conventions, mailInfo } = await DataAPI.load();

    renderNewEmailForm(conventions, mailInfo.copies.copy, mailInfo.emails);
    renderEmails(emails);
}