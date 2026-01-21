// Blocklist of YouTube IDs that cannot be embedded
// These videos exist on YouTube but have embedding disabled by the owner
// The song matcher uses this list to filter out these songs at runtime

export const BLOCKED_YOUTUBE_IDS = new Set([
    // From validation - these are confirmed non-embeddable
    'V96u7_fS6_4', // Tere Sang Yaara
    '3XTz8ck0n_A', // Tujhse Naraz Nahi Zindagi
    'X0yQKpYOQT8', // Tadap Tadap
    'e3MpRlQHVYo', // Ye Dooriyan
    'zL8G9qT3iJM', // Muskurane
    'L6fGx2hGa3o', // Raabta
    'k1mC0m_4OJU', // Duaa
    'bHoWlHXhNJ0', // Sanam Teri Kasam
    'zfCvQy2M7IU', // Tere Bina
    'qOKRxBspeQA', // Enna Sona
    'eTqkIV-QFzQ', // Subhaan Allah
    'CuZFnRNJqec', // Phir Le Aya Dil
    'p1jmqr76uYo', // Tum Jo Aaye
    'oBN-aonU860', // Soch Na Sake
    'qbdRmzQ42GQ', // Hasi
    'NkRwPvFXxPc', // Rozana
    'x_zTQ9bF3dE', // Tujhi Mein
    'aN-DmH1rjKI', // Ilahi
    'V-9wXVv9a-M', // Heer Ranjha
    'Uxz3zTd3S94', // Dil Ka Telephone
    'fQ_9WFqhKvk', // Tera Ban Jaunga
    'M2YPEuBvvhU', // Labon Ko
    'dYKJsHvEBPI', // Tu Hi Meri Shab Hai
    'HVdVCnzNFvQ', // Zara Zara
    'rTVlMT6hBD4', // Pal Pal Dil Ke Paas
    'UdEnqT9flNA', // O Saathi
    'pYJl2HyHJqE', // Mere Sohneya
    'rqD-1wJyTMk', // Khairiyat Pucho
    'bIx9FKPn1yE', // Phir Mohabbat
    'KwgH_WvQElo', // Ranjha
    'qSIh_eAQ9bU', // O Mere Dil Ke Chain
    'o7bE9LaBd3E', // Thodi Der
    'J_vGSV1cz4g', // Tera Fitoor
    'qT8ex0b_Fsc', // Zaalima
    '1S8r9n5Lfww', // Channa Ve
    'oKFNmU8iJkE', // Tu Meri
    'roQo2M4MBP4', // Teri Mitti
    't1R1DvZBv7U', // Bulleya
    'WUy4Z4NqXBM', // Ishq Mubarak
    'A4dJqssBv-o', // Jeene Bhi De
    '3rQLDJE4-00', // Thoda Aur
    'l2Z-bz-3qbQ', // Zindagi
    'zLwBNMNb7m8', // Qaafirana
    'jXNWl8e3E1Q', // Mana Ki Hum Yaar Nahi
    'TnNpVPxN_D0', // Dil Chahte Ho
    'i6R6g2OHfkQ', // Mann Bharrya
    '2XmSJsNGYPM', // Taaron Ke Shehar
    'FYkPXfxPmGQ', // Laal Ishq
    '8c9kf0bWKJo', // Aa Bhi Jaa Tu
    'NepmCjJ2Guo', // Humraah
    '4Yxb7t75J24', // Woh Lamhe
    'jjGY1F3wfSc', // Tujhe Sochta Hoon
    'Z3eOYTIe9Zg', // Aye Khuda
    'C-iqj1Q5d20', // Tum Tak
    'pJH8pyBl_wE', // Mere Rashke Qamar
    'pO2Nt0kPXqM', // Zehnaseeb
    '8xfnxALgPmE', // Agar Tum Mil Jao
    'uWS3lGlW3x4', // Tera Chehra
    'DaGXXlBGJM8', // Sun Mere Humsafar
    'xM79P0QoL40', // Baatein Ye Kabhi Na
    'HNq0_9Hqx7Q', // Teri Yaad
    'bVnZqHQsMTk', // Tum Mile
    'LqjLQvCGUhQ', // Saiyaan
    'B_Xy7fhbpL4', // Sajni
    '5awRhAK0FRs', // Tum Ho Toh
    'W5uGxRh0r6k', // Chupana Bhi Nahin Aata
    '8XZ6uKLa8BI', // Dard Dilo Ke
    'k5qSxqG_GjM', // Mera Dil Bhi Kitna Pagal Hai
    'rl4L-xJfJNI', // Tum Dil Ki Dhadkan Main
    '0p1C8C84p-A', // Mohabbatein Love Theme
    '5FpLQfR6c3U', // Chalte Chalte
    'nQ5kQ4xowBA', // Kuch Kuch Hota Hai
    '2UHYz4gVTt0', // Aur Ho
    '8h3jXmEu8SU', // Jaadu Hai Nasha Hai
    'QfDiNv6Wy_Y', // Zara Si Dil Mein
    'VfYGXRNQGLs', // Alvida
    'JzSBEGwp_0s', // Tujh Mein Rab Dikhta Hai
    'x9ZhG3qXCHI', // Channa Mereya Reprise
    'wNlFrwPBOGQ', // Mere Haath Mein
    'n1yfwX1dQ50', // Pee Loon Reprise
    '32m1KExlSwo', // Kabira Encore
    'U6kXZ0uxKTY', // Saathi Re
    'GTBJCj0KoNw', // Tera Intezaar
    'rIJWpKVFJfQ', // Sajna
    'bfS4VINBqlk', // Abhi Nahi Aana
    'PBqZLnUYZYY', // Maahi Ve
    'TFr6G5zveS8', // Lag Ja Gale
    'j3aYKQFkr7Q', // Dil Ke Armaan
    'SQWPx_Dq_Lo', // Aaj Din Chadheya
    '5TcR_xwn9zo', // Teri Jhuki Nazar
    'NlSXPm0-q9k', // Rehne De
    'UxLr_K3WQrE', // Tumse Milke
    'vXdHR9TFv1Q', // Mere Mehboob
    'RWcQ0Ru9FaI', // Tera Naam
    'Xv3z0c6LQZI', // Woh Pehli Baar
    'r0iyTTpSPps', // Awargi
    'jONGFDk0qgs', // Mast Magan
    '8KVo_8c1uOw', // O Humsafar
    'K31LrMIPHWw', // Besharam Rang
    '-kDJXl4qL5c', // Tere Hawale
    'mC7jjH4-VzU', // Apna Bana Le
    'ykP5tWtVRG8', // Phir Aur Kya Chahiye
    'E3yifwFWBWE', // Pal
    'mKCteR4HcNk', // Naina
    'gRnPEB0TJ9A', // Ilahi Mera Jee Aaye
    'Q61ry9slT2o', // Kalank
    'FTkB4aHv1ps', // Ghar Se Nikalte Hi
    '2gD6wRo8EU0', // Saansein
    'xqA4WfjxPDk', // O Jaana
    'G_J2Mw3dPRY', // Tu Jhoom
    'q5TrZ5fSP0c', // Mast Kalandar
    'l-xKRLNzJ7U', // Dholna
    'f7LGdQ7fZUs', // Heyy Babyy Title Song
    'LZ3EYH0iQf0', // Mujhko Barsaat Bana Lo
    'vLz3k4Kfzn4', // Ishqe Di Lat
    'xDv9vJCVAF4', // Junooniyat Title Track
    'y5e6U3L9FZ4', // Pagalon Sa Naach
    'V2qg2MuPb2M', // Jogi
    'P2yNYIFPjMg', // Mera Intkam Dekhegi
    'oT9Kqk5-jJs', // Pallo Latke
    'YzYh3t6f9oM', // Tu Banja Gali Benaras Ki
    '-WzKMPZEZQ8', // Ghodey Pe Sawaar
    'DPG_NXWE8Sk', // Rubaaiyaan
    'TcKdUzVcLf8', // Shauq
    'YKDXJVD-g3Y', // Nirbhau Nirvair
    'Xy8e7f4r2Ik', // Vekh Sohneyaa
    '6FZYjLKgxLc', // Churaaiyaan
    'tU3KS1j9H_0', // Warey
    'n8dJLl5EKL4', // Kyaa Karun
    'u4d8MFGYaXM', // Hey Bae
    'xFH_8dwZTkQ', // Yaara Tere Bin
    'aPLXzg7fVPk', // Kabhi Jo Baadal Barse
    'bT9hGlZBHg4', // Ishq Bulaava
    'bGZ8RhbMxug', // Raanjhanaa
    '0GQCmQcE6xU', // Kinna Sona
    // Punjabi
    'Wj-a6tXJwGc', // Mahiya : Satinder Sartaaj
    'oE7lU2qj4rY', // Hasan RaheemWishes ft
    'aLOg6dJHOaI', // Viah
    'jMyO4AnOWb0', // Vailly Jatt
    'LSDxjp6sWYQ', // JATT DA MUQABALA
    // English
    'kUM8K0WvfkQ', // Steal The Show
    '1i7p0vYdwt8', // Don't
    '4A1aV2s2_6w', // Is It Over Now?
    'YW89DFzHYWs', // Now That We Don't
    'J4BvJt4t2B0', // Who's
]);
