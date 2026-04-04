import os
import asyncio
import edge_tts

# 대사 정의
mbti_lines = {
    "intj": ("분석 완료. 논리가 곧 힘이야.", "+0Hz"),
    "intp": ("흠.. 흥미로운 관점이네. 나중에 파보자.", "-5Hz"),
    "entj": ("날 따라와! 내가 지휘할게!", "+5Hz"),
    "entp": ("잠깐, 그거 확실해? 내가 반박해 볼까?", "+10Hz"),
    "infj": ("네 마음, 전해질 수 있도록 내가 도울게.", "-5Hz"),
    "infp": ("나만의 세계로 널 초대할게. 같이 갈래?", "-10Hz"),
    "enfj": ("우리 다 같이 힘내면 뭐든 할 수 있어!", "+5Hz"),
    "enfp": ("우와! 재미있겠다! 나도 해볼래!", "+15Hz"),
    "istj": ("원칙대로 처리해 줘. 변수는 질색이니까.", "-5Hz"),
    "isfj": ("불편한 건 없어? 내가 다 챙겨줄 테니까 걱정 마.", "+0Hz"),
    "estj": ("최선을 다해. 결과로 보여달라고!", "+5Hz"),
    "esfj": ("다들 잘 지냈어? 앗, 내가 도와줄게!", "+10Hz"),
    "istp": ("말보단 행동이지. 일단 부딪혀 봐.", "-10Hz"),
    "isfp": ("내 방식대로 할래. 조용히, 그리고 자유롭게.", "-5Hz"),
    "estp": ("규칙이 어딨어? 일단 즐기고 보는 거지!", "+15Hz"),
    "esfp": ("오늘 주인공은 나야! 신나게 놀아보자!", "+20Hz")
}

donation_lines = {
    "donate_normal": ("후원 정말 고마워! 잘 쓸게!", "+10Hz"),
    "donate_super": ("꺄아! 엄청난 후원! 너 완전 최고야!", "+20Hz")
}

async def generate_voices():
    os.makedirs("assets/sounds/voices", exist_ok=True)
    voice = "ko-KR-SunHiNeural"
    
    # Generate MBTI
    for mbti, (text, pitch) in mbti_lines.items():
        print(f"Generating {mbti}...")
        communicate = edge_tts.Communicate(text, voice, pitch=pitch)
        await communicate.save(f"assets/sounds/voices/{mbti}.mp3")

    # Generate Donations
    for key, (text, pitch) in donation_lines.items():
        print(f"Generating {key}...")
        communicate = edge_tts.Communicate(text, voice, pitch=pitch)
        await communicate.save(f"assets/sounds/voices/{key}.mp3")

if __name__ == "__main__":
    asyncio.run(generate_voices())
