export default async function handler(req, res) {
	if (req.method !== "GET") return res.status(405).end();

	const { address } = req.query;
	const kakaoKey = (process.env.KAKAO_REST_KEY || "").trim();

	try {
		// --- 1차 시도: 주소 검색 (address.json) ---
		const addrUrl = new URL(
			"https://dapi.kakao.com/v2/local/search/address.json"
		);
		addrUrl.searchParams.append("query", address);

		const addrRes = await fetch(addrUrl.toString(), {
			headers: { Authorization: `KakaoAK ${kakaoKey}` },
		});
		const addrData = await addrRes.json();

		// 주소 검색 결과가 있으면 즉시 반환
		if (addrData.documents && addrData.documents.length > 0) {
			return res.status(200).json({
				x: addrData.documents[0].x,
				y: addrData.documents[0].y,
				address_name: addrData.documents[0].address_name,
			});
		}

		// --- 2차 시도: 키워드(장소) 검색 (keyword.json) ---
		// 주소 검색 결과가 없을 때만 실행됩니다.
		const keywordUrl = new URL(
			"https://dapi.kakao.com/v2/local/search/keyword.json"
		);
		keywordUrl.searchParams.append("query", address);

		const keyRes = await fetch(keywordUrl.toString(), {
			headers: { Authorization: `KakaoAK ${kakaoKey}` },
		});
		const keyData = await keyRes.json();

		if (keyData.documents && keyData.documents.length > 0) {
			return res.status(200).json({
				x: keyData.documents[0].x,
				y: keyData.documents[0].y,
				address_name: keyData.documents[0].place_name, // 장소명 반환
			});
		}

		// 둘 다 없으면 404
		return res
			.status(404)
			.json({ error: "검색 결과가 없습니다. 주소를 더 정확히 입력해주세요." });
	} catch (error) {
		return res.status(500).json({ error: "서버 에러가 발생했습니다." });
	}
}