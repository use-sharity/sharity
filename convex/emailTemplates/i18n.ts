export type Locale = "en" | "vi" | "ru";

// ─── Date/time formatting ─────────────────────────────────────────────────────

const DATE_FORMAT_OPTIONS: Record<
	Locale,
	Intl.DateTimeFormatOptions & { locale: string }
> = {
	en: {
		locale: "en-US",
		weekday: "short",
		month: "short",
		day: "numeric",
	},
	vi: {
		locale: "vi-VN",
		weekday: "short",
		day: "numeric",
		month: "short",
	},
	ru: {
		locale: "ru-RU",
		weekday: "short",
		day: "numeric",
		month: "short",
	},
};

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

export function formatDateLocalized(ts: number, locale: Locale): string {
	const { locale: intlLocale, ...opts } = DATE_FORMAT_OPTIONS[locale];
	return new Date(ts).toLocaleDateString(intlLocale, opts);
}

export function formatWindowLocalized(
	startTs: number,
	endTs: number,
	locale: Locale,
): string {
	const s = new Date(startTs);
	const e = new Date(endTs);
	return `${formatDateLocalized(startTs, locale)}, ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

// ─── Translation strings ──────────────────────────────────────────────────────

const emailStrings: Record<Locale, Record<string, string>> = {
	en: {
		// ── Shared ──
		"shared.footer": "The community sharing platform",
		"shared.contactNone": "No contact info provided.",
		"shared.contactTelegram": "Telegram: @{handle}",
		"shared.contactWhatsapp": "WhatsApp: {number}",
		"shared.contactFacebook": "Facebook: {profile}",
		"shared.contactPhone": "Phone: {number}",

		// ── Welcome ──
		"welcome.subject": "Welcome to Sharity!",
		"welcome.preview": "Welcome to Sharity, {name}!",
		"welcome.heading": "Hey {name}!",
		"welcome.intro":
			"Welcome to Sharity — a community where neighbours share things they own but rarely use.",
		"welcome.canDoIntro": "Here's what you can do:",
		"welcome.bullet.browse":
			"Browse items — find something you need without buying it",
		"welcome.bullet.list": "List your stuff — put idle items to good use",
		"welcome.bullet.request":
			"Request a loan — pick dates, get approved, arrange pickup",
		"welcome.cta": "Explore Items",
		"welcome.callout":
			"No money changes hands. Sharity runs on trust and community goodwill.",

		// ── New Request ──
		"newRequest.subject": 'New request for "{itemName}"',
		"newRequest.preview": 'New request for "{itemName}"',
		"newRequest.heading": "New Borrow Request",
		"newRequest.greeting": "Hi {ownerName},",
		"newRequest.body":
			"{borrowerName} wants to borrow your item {itemName} for {dateRange}.",
		"newRequest.callout":
			"Review the request and approve or decline it so the borrower can plan ahead.",
		"newRequest.cta": "Review Request",
		"newRequest.footer":
			"You have up to the start date to respond. Unanswered requests expire automatically.",

		// ── Lease Approved ──
		"leaseApproved.subject": 'Your request for "{itemName}" was approved',
		"leaseApproved.preview": 'Your request for "{itemName}" was approved',
		"leaseApproved.heading": "Request Approved",
		"leaseApproved.greeting": "Hi {borrowerName},",
		"leaseApproved.body":
			"Your request for {itemName} has been approved for {dateRange}.",
		"leaseApproved.callout":
			"Next step: Propose a pickup window so you and the owner can coordinate the handover.",
		"leaseApproved.cta": "Propose Pickup Time",
		"leaseApproved.footer":
			"If you can no longer make it, you can cancel your request on the item page.",

		// ── Request Rejected ──
		"requestRejected.subject":
			'Your request for "{itemName}" was not approved',
		"requestRejected.preview":
			'Your request for "{itemName}" was not approved',
		"requestRejected.heading": "Request Not Approved",
		"requestRejected.greeting": "Hi {borrowerName},",
		"requestRejected.body":
			"Unfortunately, the owner declined your request for {itemName} ({dateRange}).",
		"requestRejected.callout":
			"Don't worry — there are plenty of other items available on Sharity. Browse the catalogue to find what you need.",
		"requestRejected.cta": "Browse Other Items",

		// ── Meetup Proposed ──
		"meetupProposed.subject.pickup":
			'Pickup time proposed for "{itemName}"',
		"meetupProposed.subject.return":
			'Return time proposed for "{itemName}"',
		"meetupProposed.preview.pickup":
			'Pickup time proposed for "{itemName}"',
		"meetupProposed.preview.return":
			'Return time proposed for "{itemName}"',
		"meetupProposed.heading.pickup": "Pickup Time Proposed",
		"meetupProposed.heading.return": "Return Time Proposed",
		"meetupProposed.greeting": "Hi {recipientName},",
		"meetupProposed.body.pickup":
			'{proposerName} proposed a time to pick up "{itemName}":',
		"meetupProposed.body.return":
			'{proposerName} proposed a time to return "{itemName}":',
		"meetupProposed.callout":
			"Review and approve this time so both parties can confirm the meetup.",
		"meetupProposed.cta": "Review & Approve",
		"meetupProposed.footer":
			"If this time doesn't work, you can propose a different window on the item page.",

		// ── Meetup Confirmed ──
		"meetupConfirmed.subject": 'Meetup confirmed for "{itemName}"',
		"meetupConfirmed.preview": 'Meetup confirmed for "{itemName}"',
		"meetupConfirmed.heading": "Meetup Confirmed",
		"meetupConfirmed.greeting": "Hi {recipientName},",
		"meetupConfirmed.body.pickup":
			'Your meetup to pick up "{itemName}" is confirmed:',
		"meetupConfirmed.body.return":
			'Your meetup to return "{itemName}" is confirmed:',
		"meetupConfirmed.whoToMeet": "Who to meet: {name}",
		"meetupConfirmed.contactInfo": "Their contact info:",
		"meetupConfirmed.cta": "View Item",
		"meetupConfirmed.callout.pickup":
			"After the meetup, mark the item as picked up on the item page to complete the handover.",
		"meetupConfirmed.callout.return":
			"After the meetup, mark the item as returned on the item page to complete the handover.",

		// ── Overdue Alert ──
		"overdueAlert.subject": 'Action needed: "{itemName}" is overdue',
		"overdueAlert.preview": 'Action needed: "{itemName}" is overdue',
		"overdueAlert.badge": "Overdue Item",
		"overdueAlert.headline.owner":
			'"{itemName}" has not been returned',
		"overdueAlert.headline.borrower":
			'You have an overdue item: "{itemName}"',
		"overdueAlert.greeting": "Hi {recipientName},",
		"overdueAlert.body.owner":
			"The return window has passed (due {dueDate}). Please contact the borrower to arrange the return.",
		"overdueAlert.body.borrower":
			"Your borrow of {itemName} was due back on {dueDate}. Please contact the owner to arrange the return as soon as possible.",
		"overdueAlert.contactLabel": "Contact {counterpartyName}:",
		"overdueAlert.cta": "View Item",
		"overdueAlert.support":
			"If you cannot reach the other party, please contact Sharity support.",

		// ── Item Available ──
		"itemAvailable.subject": '"{itemName}" is available again!',
		"itemAvailable.preview": '"{itemName}" is available again!',
		"itemAvailable.heading": "Item Available!",
		"itemAvailable.greeting": "Hi {recipientName},",
		"itemAvailable.body":
			"Great news — {itemName}, the item you were watching, is available again.",
		"itemAvailable.callout":
			"Items can be claimed quickly. Request it now before someone else does!",
		"itemAvailable.cta": "Request It Now",

		// ── Daily / Weekly Digest ──
		"digest.subject": "Your Sharity activity — {date}",
		"digest.preview": "Your Sharity activity — {date}",
		"digest.title.daily": "Daily Summary — {date}",
		"digest.title.weekly": "Weekly Summary — {date}",
		"digest.intro.daily":
			"Hi {userName}, here's what happened on Sharity in the last 24 hours:",
		"digest.intro.weekly":
			"Hi {userName}, here's what happened on Sharity this past week:",
		"digest.section.owner": "As Owner",
		"digest.section.borrower": "As Borrower",
		"digest.section.general": "General",
		"digest.cta": "Go to Sharity",
		// Notification event labels (singular | plural separated by |)
		"digest.event.new_request": "new request|new requests",
		"digest.event.request_approved": "request approved|requests approved",
		"digest.event.request_rejected": "request rejected|requests rejected",
		"digest.event.item_available": "now available|now available",
		"digest.event.pickup_proposed": "pickup proposed|pickups proposed",
		"digest.event.pickup_approved": "pickup approved|pickups approved",
		"digest.event.pickup_expired": "pickup expired|pickups expired",
		"digest.event.return_proposed": "return proposed|returns proposed",
		"digest.event.return_approved": "return approved|returns approved",
		"digest.event.return_missing": "overdue return|overdue returns",
		"digest.event.rate_transaction": "rating requested|ratings requested",
		"digest.event.rating_received": "rating received|ratings received",
	},

	vi: {
		// ── Shared ──
		"shared.footer": "Nền tảng chia sẻ cộng đồng",
		"shared.contactNone": "Không có thông tin liên hệ.",
		"shared.contactTelegram": "Telegram: @{handle}",
		"shared.contactWhatsapp": "WhatsApp: {number}",
		"shared.contactFacebook": "Facebook: {profile}",
		"shared.contactPhone": "Điện thoại: {number}",

		// ── Welcome ──
		"welcome.subject": "Chào mừng bạn đến với Sharity!",
		"welcome.preview": "Chào mừng bạn đến với Sharity, {name}!",
		"welcome.heading": "Xin chào {name}!",
		"welcome.intro":
			"Chào mừng bạn đến với Sharity — cộng đồng nơi hàng xóm chia sẻ những đồ vật ít dùng đến.",
		"welcome.canDoIntro": "Bạn có thể làm gì:",
		"welcome.bullet.browse":
			"Tìm kiếm đồ vật — tìm thứ bạn cần mà không cần mua",
		"welcome.bullet.list":
			"Đăng đồ của bạn — cho những vật dụng nhàn rỗi được sử dụng",
		"welcome.bullet.request":
			"Gửi yêu cầu mượn — chọn ngày, được chấp thuận, sắp xếp nhận hàng",
		"welcome.cta": "Khám phá đồ vật",
		"welcome.callout":
			"Không có giao dịch tiền bạc. Sharity vận hành trên sự tin tưởng và tinh thần cộng đồng.",

		// ── New Request ──
		"newRequest.subject": 'Yêu cầu mượn mới cho "{itemName}"',
		"newRequest.preview": 'Yêu cầu mượn mới cho "{itemName}"',
		"newRequest.heading": "Yêu Cầu Mượn Mới",
		"newRequest.greeting": "Xin chào {ownerName},",
		"newRequest.body":
			"{borrowerName} muốn mượn đồ vật {itemName} của bạn trong thời gian {dateRange}.",
		"newRequest.callout":
			"Xem xét yêu cầu và chấp thuận hoặc từ chối để người mượn có thể lên kế hoạch.",
		"newRequest.cta": "Xem Yêu Cầu",
		"newRequest.footer":
			"Bạn có thể phản hồi cho đến ngày bắt đầu. Yêu cầu không được trả lời sẽ tự động hết hạn.",

		// ── Lease Approved ──
		"leaseApproved.subject": 'Yêu cầu mượn "{itemName}" của bạn đã được chấp thuận',
		"leaseApproved.preview": 'Yêu cầu mượn "{itemName}" của bạn đã được chấp thuận',
		"leaseApproved.heading": "Yêu Cầu Đã Được Chấp Thuận",
		"leaseApproved.greeting": "Xin chào {borrowerName},",
		"leaseApproved.body":
			"Yêu cầu mượn {itemName} của bạn đã được chấp thuận cho thời gian {dateRange}.",
		"leaseApproved.callout":
			"Bước tiếp theo: Đề xuất khung giờ nhận hàng để bạn và chủ sở hữu có thể phối hợp.",
		"leaseApproved.cta": "Đề Xuất Giờ Nhận",
		"leaseApproved.footer":
			"Nếu bạn không thể đến, bạn có thể hủy yêu cầu trên trang đồ vật.",

		// ── Request Rejected ──
		"requestRejected.subject": 'Yêu cầu mượn "{itemName}" của bạn không được chấp thuận',
		"requestRejected.preview": 'Yêu cầu mượn "{itemName}" của bạn không được chấp thuận',
		"requestRejected.heading": "Yêu Cầu Không Được Chấp Thuận",
		"requestRejected.greeting": "Xin chào {borrowerName},",
		"requestRejected.body":
			"Rất tiếc, chủ sở hữu đã từ chối yêu cầu mượn {itemName} của bạn ({dateRange}).",
		"requestRejected.callout":
			"Đừng lo — còn rất nhiều đồ vật khác trên Sharity. Hãy duyệt danh mục để tìm thứ bạn cần.",
		"requestRejected.cta": "Xem Đồ Vật Khác",

		// ── Meetup Proposed ──
		"meetupProposed.subject.pickup": 'Đề xuất giờ nhận hàng cho "{itemName}"',
		"meetupProposed.subject.return": 'Đề xuất giờ trả hàng cho "{itemName}"',
		"meetupProposed.preview.pickup": 'Đề xuất giờ nhận hàng cho "{itemName}"',
		"meetupProposed.preview.return": 'Đề xuất giờ trả hàng cho "{itemName}"',
		"meetupProposed.heading.pickup": "Đề Xuất Giờ Nhận Hàng",
		"meetupProposed.heading.return": "Đề Xuất Giờ Trả Hàng",
		"meetupProposed.greeting": "Xin chào {recipientName},",
		"meetupProposed.body.pickup":
			'{proposerName} đã đề xuất thời gian nhận "{itemName}":',
		"meetupProposed.body.return":
			'{proposerName} đã đề xuất thời gian trả "{itemName}":',
		"meetupProposed.callout":
			"Xem xét và xác nhận thời gian này để cả hai bên có thể xác nhận cuộc gặp.",
		"meetupProposed.cta": "Xem & Xác Nhận",
		"meetupProposed.footer":
			"Nếu thời gian này không phù hợp, bạn có thể đề xuất khung giờ khác trên trang đồ vật.",

		// ── Meetup Confirmed ──
		"meetupConfirmed.subject": 'Cuộc gặp đã được xác nhận cho "{itemName}"',
		"meetupConfirmed.preview": 'Cuộc gặp đã được xác nhận cho "{itemName}"',
		"meetupConfirmed.heading": "Cuộc Gặp Đã Xác Nhận",
		"meetupConfirmed.greeting": "Xin chào {recipientName},",
		"meetupConfirmed.body.pickup":
			'Cuộc gặp để nhận "{itemName}" đã được xác nhận:',
		"meetupConfirmed.body.return":
			'Cuộc gặp để trả "{itemName}" đã được xác nhận:',
		"meetupConfirmed.whoToMeet": "Người cần gặp: {name}",
		"meetupConfirmed.contactInfo": "Thông tin liên hệ của họ:",
		"meetupConfirmed.cta": "Xem Đồ Vật",
		"meetupConfirmed.callout.pickup":
			"Sau cuộc gặp, đánh dấu đồ vật đã nhận trên trang đồ vật để hoàn tất quá trình bàn giao.",
		"meetupConfirmed.callout.return":
			"Sau cuộc gặp, đánh dấu đồ vật đã trả trên trang đồ vật để hoàn tất quá trình bàn giao.",

		// ── Overdue Alert ──
		"overdueAlert.subject": 'Cần hành động: "{itemName}" đã quá hạn',
		"overdueAlert.preview": 'Cần hành động: "{itemName}" đã quá hạn',
		"overdueAlert.badge": "Đồ Vật Quá Hạn",
		"overdueAlert.headline.owner": '"{itemName}" chưa được trả',
		"overdueAlert.headline.borrower": 'Bạn có đồ vật quá hạn: "{itemName}"',
		"overdueAlert.greeting": "Xin chào {recipientName},",
		"overdueAlert.body.owner":
			"Thời hạn trả đã qua (hạn {dueDate}). Vui lòng liên hệ người mượn để sắp xếp trả hàng.",
		"overdueAlert.body.borrower":
			"Đồ vật {itemName} bạn mượn đã hết hạn vào ngày {dueDate}. Vui lòng liên hệ chủ sở hữu để sắp xếp trả hàng sớm nhất.",
		"overdueAlert.contactLabel": "Liên hệ {counterpartyName}:",
		"overdueAlert.cta": "Xem Đồ Vật",
		"overdueAlert.support":
			"Nếu bạn không thể liên hệ được phía bên kia, vui lòng liên hệ bộ phận hỗ trợ Sharity.",

		// ── Item Available ──
		"itemAvailable.subject": '"{itemName}" đã có sẵn trở lại!',
		"itemAvailable.preview": '"{itemName}" đã có sẵn trở lại!',
		"itemAvailable.heading": "Đồ Vật Đã Có Sẵn!",
		"itemAvailable.greeting": "Xin chào {recipientName},",
		"itemAvailable.body":
			"Tin vui — {itemName}, đồ vật bạn đang theo dõi, đã có sẵn trở lại.",
		"itemAvailable.callout":
			"Đồ vật có thể được yêu cầu nhanh chóng. Hãy gửi yêu cầu ngay trước người khác!",
		"itemAvailable.cta": "Yêu Cầu Ngay",

		// ── Daily / Weekly Digest ──
		"digest.subject": "Hoạt động Sharity của bạn — {date}",
		"digest.preview": "Hoạt động Sharity của bạn — {date}",
		"digest.title.daily": "Tóm Tắt Hàng Ngày — {date}",
		"digest.title.weekly": "Tóm Tắt Hàng Tuần — {date}",
		"digest.intro.daily":
			"Xin chào {userName}, đây là những gì đã xảy ra trên Sharity trong 24 giờ qua:",
		"digest.intro.weekly":
			"Xin chào {userName}, đây là những gì đã xảy ra trên Sharity trong tuần qua:",
		"digest.section.owner": "Với Tư Cách Chủ Sở Hữu",
		"digest.section.borrower": "Với Tư Cách Người Mượn",
		"digest.section.general": "Chung",
		"digest.cta": "Đến Sharity",
		"digest.event.new_request": "yêu cầu mới|yêu cầu mới",
		"digest.event.request_approved": "yêu cầu được chấp thuận|yêu cầu được chấp thuận",
		"digest.event.request_rejected": "yêu cầu bị từ chối|yêu cầu bị từ chối",
		"digest.event.item_available": "đã có sẵn|đã có sẵn",
		"digest.event.pickup_proposed": "đề xuất nhận hàng|đề xuất nhận hàng",
		"digest.event.pickup_approved": "xác nhận nhận hàng|xác nhận nhận hàng",
		"digest.event.pickup_expired": "nhận hàng hết hạn|nhận hàng hết hạn",
		"digest.event.return_proposed": "đề xuất trả hàng|đề xuất trả hàng",
		"digest.event.return_approved": "xác nhận trả hàng|xác nhận trả hàng",
		"digest.event.return_missing": "trả hàng quá hạn|trả hàng quá hạn",
		"digest.event.rate_transaction": "yêu cầu đánh giá|yêu cầu đánh giá",
		"digest.event.rating_received": "nhận đánh giá|nhận đánh giá",
	},

	ru: {
		// ── Shared ──
		"shared.footer": "Платформа совместного использования",
		"shared.contactNone": "Контактная информация не указана.",
		"shared.contactTelegram": "Telegram: @{handle}",
		"shared.contactWhatsapp": "WhatsApp: {number}",
		"shared.contactFacebook": "Facebook: {profile}",
		"shared.contactPhone": "Телефон: {number}",

		// ── Welcome ──
		"welcome.subject": "Добро пожаловать в Sharity!",
		"welcome.preview": "Добро пожаловать в Sharity, {name}!",
		"welcome.heading": "Привет, {name}!",
		"welcome.intro":
			"Добро пожаловать в Sharity — сообщество, где соседи делятся вещами, которые редко используют.",
		"welcome.canDoIntro": "Что вы можете делать:",
		"welcome.bullet.browse":
			"Искать вещи — найдите то, что нужно, без покупки",
		"welcome.bullet.list":
			"Публиковать свои вещи — дайте простаивающим вещам вторую жизнь",
		"welcome.bullet.request":
			"Отправить заявку — выберите даты, получите одобрение, договоритесь о встрече",
		"welcome.cta": "Смотреть вещи",
		"welcome.callout":
			"Никаких денег. Sharity работает на доверии и взаимопомощи.",

		// ── New Request ──
		"newRequest.subject": 'Новая заявка на "{itemName}"',
		"newRequest.preview": 'Новая заявка на "{itemName}"',
		"newRequest.heading": "Новая Заявка на Аренду",
		"newRequest.greeting": "Здравствуйте, {ownerName},",
		"newRequest.body":
			"{borrowerName} хочет одолжить вашу вещь {itemName} на период {dateRange}.",
		"newRequest.callout":
			"Рассмотрите заявку и одобрите или отклоните её, чтобы арендатор мог планировать.",
		"newRequest.cta": "Просмотреть заявку",
		"newRequest.footer":
			"У вас есть время до даты начала для ответа. Заявки без ответа истекают автоматически.",

		// ── Lease Approved ──
		"leaseApproved.subject": 'Ваша заявка на "{itemName}" одобрена',
		"leaseApproved.preview": 'Ваша заявка на "{itemName}" одобрена',
		"leaseApproved.heading": "Заявка Одобрена",
		"leaseApproved.greeting": "Здравствуйте, {borrowerName},",
		"leaseApproved.body":
			"Ваша заявка на {itemName} одобрена на период {dateRange}.",
		"leaseApproved.callout":
			"Следующий шаг: предложите время встречи для получения вещи.",
		"leaseApproved.cta": "Предложить время получения",
		"leaseApproved.footer":
			"Если вы не сможете забрать вещь, отмените заявку на странице вещи.",

		// ── Request Rejected ──
		"requestRejected.subject": 'Ваша заявка на "{itemName}" не одобрена',
		"requestRejected.preview": 'Ваша заявка на "{itemName}" не одобрена',
		"requestRejected.heading": "Заявка Не Одобрена",
		"requestRejected.greeting": "Здравствуйте, {borrowerName},",
		"requestRejected.body":
			"К сожалению, владелец отклонил вашу заявку на {itemName} ({dateRange}).",
		"requestRejected.callout":
			"Не расстраивайтесь — на Sharity много других вещей. Просмотрите каталог, чтобы найти нужное.",
		"requestRejected.cta": "Смотреть другие вещи",

		// ── Meetup Proposed ──
		"meetupProposed.subject.pickup":
			'Предложено время получения "{itemName}"',
		"meetupProposed.subject.return":
			'Предложено время возврата "{itemName}"',
		"meetupProposed.preview.pickup":
			'Предложено время получения "{itemName}"',
		"meetupProposed.preview.return":
			'Предложено время возврата "{itemName}"',
		"meetupProposed.heading.pickup": "Предложено Время Получения",
		"meetupProposed.heading.return": "Предложено Время Возврата",
		"meetupProposed.greeting": "Здравствуйте, {recipientName},",
		"meetupProposed.body.pickup":
			'{proposerName} предложил время для получения "{itemName}":',
		"meetupProposed.body.return":
			'{proposerName} предложил время для возврата "{itemName}":',
		"meetupProposed.callout":
			"Рассмотрите и подтвердите это время, чтобы обе стороны могли подтвердить встречу.",
		"meetupProposed.cta": "Просмотреть и подтвердить",
		"meetupProposed.footer":
			"Если это время не подходит, вы можете предложить другое на странице вещи.",

		// ── Meetup Confirmed ──
		"meetupConfirmed.subject": 'Встреча подтверждена для "{itemName}"',
		"meetupConfirmed.preview": 'Встреча подтверждена для "{itemName}"',
		"meetupConfirmed.heading": "Встреча Подтверждена",
		"meetupConfirmed.greeting": "Здравствуйте, {recipientName},",
		"meetupConfirmed.body.pickup":
			'Ваша встреча для получения "{itemName}" подтверждена:',
		"meetupConfirmed.body.return":
			'Ваша встреча для возврата "{itemName}" подтверждена:',
		"meetupConfirmed.whoToMeet": "С кем встречаться: {name}",
		"meetupConfirmed.contactInfo": "Контактная информация:",
		"meetupConfirmed.cta": "Просмотреть вещь",
		"meetupConfirmed.callout.pickup":
			"После встречи отметьте вещь как полученную на странице вещи для завершения передачи.",
		"meetupConfirmed.callout.return":
			"После встречи отметьте вещь как возвращённую на странице вещи для завершения передачи.",

		// ── Overdue Alert ──
		"overdueAlert.subject": 'Требуется действие: "{itemName}" просрочена',
		"overdueAlert.preview": 'Требуется действие: "{itemName}" просрочена',
		"overdueAlert.badge": "Просроченная вещь",
		"overdueAlert.headline.owner": '"{itemName}" не была возвращена',
		"overdueAlert.headline.borrower":
			'У вас есть просроченная вещь: "{itemName}"',
		"overdueAlert.greeting": "Здравствуйте, {recipientName},",
		"overdueAlert.body.owner":
			"Срок возврата истёк ({dueDate}). Пожалуйста, свяжитесь с арендатором для организации возврата.",
		"overdueAlert.body.borrower":
			"Срок аренды {itemName} истёк {dueDate}. Пожалуйста, как можно скорее свяжитесь с владельцем для возврата.",
		"overdueAlert.contactLabel": "Связаться с {counterpartyName}:",
		"overdueAlert.cta": "Просмотреть вещь",
		"overdueAlert.support":
			"Если вы не можете связаться с другой стороной, обратитесь в поддержку Sharity.",

		// ── Item Available ──
		"itemAvailable.subject": '"{itemName}" снова доступна!',
		"itemAvailable.preview": '"{itemName}" снова доступна!',
		"itemAvailable.heading": "Вещь Доступна!",
		"itemAvailable.greeting": "Здравствуйте, {recipientName},",
		"itemAvailable.body":
			"Отличные новости — {itemName}, вещь, за которой вы следите, снова доступна.",
		"itemAvailable.callout":
			"Вещи быстро разбирают. Отправьте заявку прямо сейчас, пока не опоздали!",
		"itemAvailable.cta": "Отправить заявку",

		// ── Daily / Weekly Digest ──
		"digest.subject": "Ваша активность на Sharity — {date}",
		"digest.preview": "Ваша активность на Sharity — {date}",
		"digest.title.daily": "Ежедневная сводка — {date}",
		"digest.title.weekly": "Еженедельная сводка — {date}",
		"digest.intro.daily":
			"Здравствуйте, {userName}, вот что произошло на Sharity за последние 24 часа:",
		"digest.intro.weekly":
			"Здравствуйте, {userName}, вот что произошло на Sharity за прошедшую неделю:",
		"digest.section.owner": "Как владелец",
		"digest.section.borrower": "Как арендатор",
		"digest.section.general": "Общее",
		"digest.cta": "Перейти на Sharity",
		"digest.event.new_request": "новая заявка|новых заявки|новых заявок",
		"digest.event.request_approved": "заявка одобрена|заявки одобрены|заявок одобрено",
		"digest.event.request_rejected": "заявка отклонена|заявки отклонены|заявок отклонено",
		"digest.event.item_available": "доступна|доступны|доступно",
		"digest.event.pickup_proposed": "встреча предложена|встречи предложены|встреч предложено",
		"digest.event.pickup_approved": "встреча подтверждена|встречи подтверждены|встреч подтверждено",
		"digest.event.pickup_expired": "встреча истекла|встречи истекли|встреч истекло",
		"digest.event.return_proposed": "возврат предложен|возврата предложены|возвратов предложено",
		"digest.event.return_approved": "возврат подтверждён|возврата подтверждены|возвратов подтверждено",
		"digest.event.return_missing": "просроченный возврат|просроченных возврата|просроченных возвратов",
		"digest.event.rate_transaction": "запрос оценки|запроса оценки|запросов оценки",
		"digest.event.rating_received": "оценка получена|оценки получены|оценок получено",
	},
};

// ─── Translation helpers ───────────────────────────────────────────────────────

export function t(
	locale: Locale,
	key: string,
	params?: Record<string, string>,
): string {
	let str = emailStrings[locale]?.[key] ?? emailStrings.en[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			str = str.replaceAll(`{${k}}`, v);
		}
	}
	return str;
}

/**
 * Pluralize a digest event label.
 * String format: "singular|plural" (en/vi) or "1|2-4|5+" (ru).
 */
export function pluralize(
	locale: Locale,
	key: string,
	count: number,
): string {
	const raw = t(locale, key);
	const parts = raw.split("|");
	if (locale === "ru" && parts.length === 3) {
		const mod10 = count % 10;
		const mod100 = count % 100;
		if (mod10 === 1 && mod100 !== 11) return `${count} ${parts[0]}`;
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
			return `${count} ${parts[1]}`;
		return `${count} ${parts[2]}`;
	}
	return `${count} ${count === 1 ? (parts[0] ?? raw) : (parts[1] ?? parts[0] ?? raw)}`;
}

export function contactLines(
	contacts: {
		telegram?: string;
		whatsapp?: string;
		facebook?: string;
		phone?: string;
	},
	locale: Locale,
): string {
	const lines: string[] = [];
	if (contacts.telegram)
		lines.push(t(locale, "shared.contactTelegram", { handle: contacts.telegram }));
	if (contacts.whatsapp)
		lines.push(t(locale, "shared.contactWhatsapp", { number: contacts.whatsapp }));
	if (contacts.facebook)
		lines.push(t(locale, "shared.contactFacebook", { profile: contacts.facebook }));
	if (contacts.phone)
		lines.push(t(locale, "shared.contactPhone", { number: contacts.phone }));
	return lines.length > 0 ? lines.join("\n") : t(locale, "shared.contactNone");
}
