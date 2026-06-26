// English (canonical / fallback) translations.
// All keys must exist here; other locales fall back to this catalog.
export const en: Record<string, string> = {
  // ===== App-wide =====
  'app.name': 'VolleyBot',
  'app.loading': 'Loading…',
  'app.youreAllSet': "You're all set!",
  'app.loadingHome': 'Loading your home page…',

  // ===== Navigation =====
  'nav.home': 'Home',
  'nav.games': 'Games',
  'nav.create': 'Create',
  'nav.profile': 'Profile',
  'nav.test': 'Test',

  // ===== Welcome / onboarding =====
  'welcome.title': 'Welcome to VolleyBot',
  'welcome.subtitle': 'Pick your playing level to get started.',
  'welcome.cta': 'Continue',
  'welcome.done.title': "You're all set!",
  'welcome.done.subtitle': 'Loading your home page…',

  // ===== Skill labels =====
  'skill.LEVEL_1': 'Beginner',
  'skill.LEVEL_2': 'Beginner (Amateur)',
  'skill.LEVEL_3': 'Intermediate',
  'skill.LEVEL_4': 'Advanced',
  'skill.LEVEL_5': 'Semi-Pro',
  'skill.LEVEL_6': 'Professional',

  // ===== Home =====
  'home.title': 'Home',
  'home.hello': 'Hello, {name}!',
  'home.upcomingGames': 'Upcoming games',
  'home.seeAll': 'See all',
  'home.noGames': 'No upcoming games yet',
  'home.findGame': 'Find a game',
  'home.createGame': 'Create a game',
  'home.pickYourLevel': 'Pick your playing level',
  'home.pickYourLevelSub': 'Tell other players how strong you are so they can match you up.',

  // ===== Profile =====
  'profile.title': 'Profile',
  'profile.about': 'About you',
  'profile.age': 'Age',
  'profile.city': 'City',
  'profile.language': 'Language',
  'profile.bio': 'Short bio (optional)',
  'profile.skill': 'Playing level',
  'profile.skillFromEvaluations': 'Based on {n} evaluations',
  'profile.save': 'Save',
  'profile.saved': 'Profile saved',
  'profile.signOut': 'Sign out',
  'profile.signOutConfirm': 'Sign out of VolleyBot?',
  'profile.adminPanel': 'Admin panel',
  'profile.blacklist': 'Blocked players',
  'profile.invitations': 'Invitations',
  'profile.payments': 'Payments',

  // ===== Games list =====
  'games.title': 'Games',
  'games.filter.city': 'City',
  'games.filter.skill': 'Skill',
  'games.filter.skillAny': 'Any level',
  'games.filter.bucket.beginner': 'Beginner',
  'games.filter.bucket.intermediate': 'Intermediate',
  'games.filter.bucket.advanced': 'Advanced',
  'games.filter.dateFrom': 'From',
  'games.filter.dateTo': 'To',
  'games.filter.spots': 'Spots',
  'games.filter.any': 'Any',
  'games.filter.search': 'Search notes',
  'games.filter.apply': 'Apply',
  'games.filter.clear': 'Clear',
  'games.empty': 'No games match your filters.',

  // ===== Game card =====
  'game.spots': '{count} / {total} spots',
  'game.spotsFull': 'Full',
  'game.spotsOneLeft': '1 spot left',
  'game.spotsLeft': '{n} spots left',
  'game.perPlayer': '{amount} / player',
  'game.closed': 'Closed lobby',
  'game.closedHint': 'Invite-only — request to join and the host will approve.',
  'game.paid': 'Paid game',
  'game.free': 'Free game',
  'game.host': 'Host',
  'game.join': 'Join',
  'game.leave': 'Leave',
  'game.cancel': 'Cancel game',
  'game.finish': 'Finish game',
  'game.requestToJoin': 'Request to join',
  'game.requestPending': 'Request pending',
  'game.evaluations': 'Rate players',
  'game.managePayments': 'Track payments',
  'game.invitePlayers': 'Invite players',

  // ===== Game detail =====
  'gameDetail.players': 'Players',
  'gameDetail.noPlayers': 'No players yet',
  'gameDetail.address': 'Address',
  'gameDetail.startsAt': 'Starts',
  'gameDetail.notes': 'Notes',
  'gameDetail.cover': 'Venue photo',

  // ===== Create game =====
  'create.title': 'New game',
  'create.subtitle': 'Fill in the details and invite players',
  'create.section.where': 'Where',
  'create.section.when': 'When',
  'create.section.who': 'Who',
  'create.section.cost': 'Cost',
  'create.section.notes': 'Notes',
  'create.field.venue': 'Venue',
  'create.field.selectVenue': '— select a venue —',
  'create.field.start': 'Start',
  'create.field.duration': 'Hours',
  'create.field.skill': 'Skill level',
  'create.field.spots': 'Total spots',
  'create.field.unlimited': 'No limit',
  'create.field.totalCost': 'Total court cost',
  'create.field.currency': 'Currency',
  'create.field.addressHint': 'Address / meeting point',
  'create.field.coverImage': 'Cover photo URL (optional)',
  'create.field.paid': 'This is a paid game',
  'create.paidStatus.on': 'Paid game — players will owe the per-player price.',
  'create.paidStatus.off': 'Free game — leave the cost at 0 to keep it free.',
  'create.field.noVenues': 'No venues in your city yet. Add one from the Games tab.',
  'create.field.closed': 'Closed lobby (invite-only)',
  'create.cta': 'Create game',
  'create.cta.creating': 'Creating…',
  'create.cost.auto': 'Auto: {venue} × {hours}h.',
  'create.cost.custom': 'You set a custom amount.',
  'create.cost.empty': 'Select a venue to auto-fill.',
  'create.perPlayer': 'Per player: {amount}',
  'create.splitBetween': 'Split between {n} players',
  'create.unlimitedHint': 'No upper limit on players',
  'create.venueMax': 'Venue max: {n} players',

  // ===== Blacklist =====
  'blacklist.title': 'Blocked players',
  'blacklist.empty': "You haven't blocked anyone.",
  'blacklist.add': 'Block a player',
  'blacklist.reason': 'Reason (optional)',
  'blacklist.remove': 'Unblock',
  'blacklist.maxed': 'You can block up to 10 people. Remove one first.',
  'blacklist.warning.title': 'Blocked player in this game',
  'blacklist.warning.body': 'You blocked {name}. Are you sure you want to join anyway?',
  'blacklist.warning.confirm': 'Join anyway',
  'blacklist.warning.cancel': 'Cancel',

  // ===== Reports =====
  'report.title': 'Report user',
  'report.reason.toxic': 'Toxic behavior',
  'report.reason.skipped': 'Skipped a game',
  'report.reason.harassment': 'Harassment',
  'report.reason.cheating': 'Cheating',
  'report.reason.other': 'Other',
  'report.details': 'Details (optional)',
  'report.submit': 'Submit report',
  'report.thanks': 'Thanks — admins will review this.',

  // ===== Evaluations =====
  'eval.title': 'Rate players',
  'eval.subtitle': 'After this game, tell us how strong each player was.',
  'eval.alreadyRated': 'Already rated',
  'eval.skip': 'Skip',
  'eval.submit': 'Submit ratings',
  'eval.thanks': 'Thanks — your ratings were submitted.',

  // ===== Invitations =====
  'invite.title': 'Invitations',
  'invite.empty': 'No pending invitations.',
  'invite.accept': 'Accept',
  'invite.decline': 'Decline',
  'invite.invitePlayer': 'Invite a player',
  'invite.invited': 'Invitation sent',

  // ===== Payments =====
  'payments.title': 'Payments',
  'payments.totalCost': 'Total cost',
  'payments.perPlayer': 'Per player',
  'payments.paid': 'Paid',
  'payments.unpaid': 'Unpaid',
  'payments.markPaid': 'Mark paid',
  'payments.markUnpaid': 'Mark unpaid',
  'payments.myUnpaid': 'You owe {amount} for {venue}',

  // ===== Calendar =====
  'calendar.title': 'Calendar',
  'calendar.today': 'Today',
  'calendar.upcoming': 'Upcoming',
  'calendar.past': 'Past',

  // ===== Language picker =====
  'lang.title': 'Language',
  'lang.uk': 'Українська',
  'lang.pl': 'Polski',
  'lang.en': 'English',
  'lang.ru': 'Русский',

  // ===== Auth / banned =====
  'auth.banned.title': 'You have been banned',
  'auth.banned.body': 'Reason: {reason}',
  'auth.banned.contact': 'Contact support if you think this is a mistake.',

  // ===== Common =====
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.confirm': 'Confirm',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.error': 'Something went wrong',
  'common.close': 'Close',
  'common.optional': 'Optional',
  'common.you': 'You',

  // ===== Banners =====
  'banner.signOut': 'Signed out.',
  'banner.saved': 'Saved.',
  'banner.deleted': 'Deleted.',

  // ===== Admin =====
  'admin.title': 'Admin panel',
  'admin.users': 'Users',
  'admin.games': 'Games',
  'admin.venues': 'Venues',
  'admin.reports': 'Reports',
  'admin.audit': 'Audit',
  'admin.heatmap': 'Heatmap',
  'admin.stats': 'Stats',
  'admin.search': 'Search…',
  'admin.ban': 'Ban',
  'admin.unban': 'Unban',
  'admin.banReason': 'Ban reason',
  'admin.cancelGame': 'Cancel game',
  'admin.resolve': 'Mark reviewed',
  'admin.dismiss': 'Dismiss',
  'admin.resolveAndBan': 'Mark reviewed & ban',

  // ===== Errors =====
  'error.network': 'Network error. Please try again.',
  'error.unauthorized': 'Please sign in again.',
  'error.forbidden': 'You do not have permission to do that.',
  'error.notFound': 'Not found.',
  'error.tooLarge': 'The file is too large.',
  'error.unknown': 'Something went wrong.',

  // ===== Empty states =====
  'empty.notSignedIn': 'Not signed in',
  'empty.notSignedInText': 'Open this Mini App from Telegram to set up your profile.',

  // ===== Onboarding banner =====
  'onboarding.chooseLevel': 'Choose your level',
  'onboarding.levelPrompt': 'Pick the level that best describes you. Other players use this to match games.',

  // ===== Cities / defaults =====
  'city.default': 'Default city',

  // ===== Toast / messages =====
  'msg.profileUpdated': 'Profile updated',
  'msg.gameCreated': 'Game created',
  'msg.gameCancelled': 'Game cancelled',
  'msg.gameLeft': 'Left the game',
  'msg.gameJoined': 'Joined the game',
  'msg.blacklistAdded': 'Player blocked',
  'msg.blacklistRemoved': 'Player unblocked',
  'msg.reportSubmitted': 'Report submitted',
  'msg.evaluationsSubmitted': 'Ratings submitted',
  'msg.invitationResponded': 'Invitation updated',
  'msg.paymentUpdated': 'Payment updated',
  'msg.languageUpdated': 'Language updated',
  'msg.locationUpdated': 'Location updated',
  'msg.signOutDone': 'You are signed out',
};