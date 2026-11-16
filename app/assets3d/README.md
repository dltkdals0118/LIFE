# 3D 캐릭터

작성: WACUS

LIFE 홈 화면과 포트폴리오 히어로에 서 있는 소년. **디자인 정본은 여전히
`app/src/Character.tsx` 의 주석이다** — 4등신, 턱이 좁은 얼굴, 가는 팔다리,
그리고 의상 다섯: 스카프 · 허리에 묶은 옷 · 손가락 없는 장갑 · 걷어올린 바지 ·
끈 부츠. "이 다섯이 빠지면 그냥 티셔츠 입은 아이로 돌아간다."

## 파일

| | |
|---|---|
| `life_boy.blend` | **정본.** 42k 삼각형 · 1024² 텍스처 · 셰이프키 `blink`·`breathe` |
| `../public/character.glb` | 웹용 내보내기(1.4MB). LIFE 가 읽는다 |
| `Portfolio/assets/character.glb` | 위 파일의 복사본. 포트폴리오가 읽는다 |
| `_gen/` | 생성 중간물. git 에 올리지 않는다(다시 만들 수 있고 11MB다) |

## 어떻게 만들었나

1. 레퍼런스 턴어라운드에서 정면·측면을 잘라 Magnific 에 올리고, 거기서
   **스타일을 옮긴 정면 이미지**를 만들었다(큰 둥근 눈·둥근 머리의 귀여운 비율,
   옷 색은 `Character.tsx` 의 팔레트 — 금색 스카프 · 크림 상의 · 올리브 허리옷 ·
   청회색 바지 · 갈색 장갑과 부츠).
   레퍼런스를 그대로 3D 로 뜨지 않은 이유: 다른 작가의 캐릭터를 복제하게 된다.
2. 그 이미지를 image-to-3D(tripo-v31, 텍스처 detailed)로 돌려 glb 를 받았다.
3. 블렌더에서 세우고(키 1.388 m · 발바닥 z=0 · 정면이 −Y), 42k 로 줄이고,
   셰이프키 둘을 만들어 glb 로 내보냈다.

**처음엔 프리미티브(통·구)를 스크립트로 쌓아 직접 모델링했다.** 그 방식으로는
레퍼런스 같은 **하나로 이어진 조형**이 나오지 않는다 — 부품이 서로 뚫고 들어간
인형이 된다. 그 시도는 `chargen.py` 로 커밋돼 있다(`git log -- app/assets3d/chargen.py`).

## 다시 내보내려면

블렌더에서 `life_boy.blend` 를 열고:

```python
ob = bpy.data.objects["life_boy"]
for o in bpy.data.objects: o.select_set(False)
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(
    filepath="<repo>/app/public/character.glb", export_format="GLB",
    use_selection=True, export_apply=True, export_yup=True,
    export_morph=True, export_morph_normal=False, export_morph_tangent=False,
    export_animations=False, export_cameras=False, export_lights=False,
    export_image_format="JPEG", export_jpeg_quality=85)
```

그다음 포트폴리오 쪽에도 복사한다 — `Portfolio/assets/character.glb`.

## 지킬 것

- **애니메이션 클립을 넣지 않는다.** 모프 타깃 둘만 싣고 값은 웹에서 움직인다.
  깜빡임은 간격이 일정하면 기계로 보인다.
- **축 주의** — 블렌더는 Z 가 위지만 **glTF 는 Y 가 위다.** 내보내면서 바뀐다.
  블렌더 기준으로 카메라를 두면 캐릭터를 아래에서 비스듬히 보게 된다.
- **키 1.388 m 는 약속이다.** 웹 쪽 두 파일(`Character3D.tsx`,
  `character3d.src.js`)이 이 값으로 화면 칸을 맞춘다. 바꾸면 둘 다 바꾼다.
