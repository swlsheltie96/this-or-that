import { Database } from "bun:sqlite";

const db = new Database("lists.db");
db.exec("PRAGMA journal_mode=WAL");

const images: Record<string, string> = {
  "The Arrow": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiBBef2qIKpY-zmE9x9DEmScZgL2GunZf2xTBovmYa42g74S0eo1pHBfSJlCzLasmbhFaAHIUKlyeMssibTQVdnGGqnvzwPPc_Z9EmROLWxr-wWoIQc6M_icAiCs62hNgeN0LBJ3aY5LP4/s1600/The+Arrow.jpg",
  "The Big": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgmry8xC_lqS3drzWmXQJk0baBM_DPfJgoxiTpx4xB8CtYU6bapw9fc645iSWMqr5mi7wF_DX0-v_X_ksYnIISt926Zko0wfDJ41HNZpLPc-iFIx4RXe0QA6gbnBfXShv_fGo0a7JmmkiQ/s1600/The+Big.jpg",
  "The Bubbles": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgOoBiUoEfK6GjtiEUvOMEKs2m1GX5ktQcp5NKxNrk5s7kbhdlYO0YCjgTMS-530_8pOdYw0YjUYyEwMZ7W-New7PCzbS6FDt9FgFXSjuvooqVMmDUDkKHJID4ki8U0vrZiihB_XWewn_E/s1600/The+Bubbles.jpg",
  "The Change": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjJuFe5vfTCd15XV9SRWNgCy17aAu8bI27bJBkovEZwz4-kWUFz45_WpbJwQDLQByOTiv5QvnroHrR2NeLsfC83QoQ2DTVh85GTpVqS1NKj46FebNokSfkG-byiu8lrreKmXGotfucnLos/s1600/The+Change.jpg",
  "The Cloud": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhGAarGa_8gao1oAJnLahH9WCXsyIaEUdUnFRPeAT01XLHf5kotzGevMVF7TDqsfqSkAGc88br26hGx3n2U6damV2dWrv1M1geuClF2WKfF7OPZZh7R-Ip79YkSIQFsy-3_fUvh0pSDkmY/s1600/The+Cloud.jpg",
  "The Create": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjUY-_o5lYnbMRfDF1rQCJwkr7z5P8X5F93s3H4cQmkKezlWsNc1DEiPdUb79Z7ZC2wkO0WPds_H0kGimJYbdtbFA55X_MA43piSnGZIg4pDksJBv9l4s_l8HzE2hZ93Fmm3eAVjnzzrM8/s1600/The+Create.jpg",
  "The Dark": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjFT6JEjwCWBm0VWTic4ROeOF4Lq0KT390cHV59ik26s1yl6zd2Y7XJ3ub2nJ9EeKMcNYY3d3qEPqEaeaxVG8sUKj_EwSRHaSPkRO-Jna0D1xoEBVHzlqppjzzWxjxVfYnZsmS6vnUfFuw/s1600/The+Dark.jpg",
  "The Dash": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgp-YQjCLhQ6Y9G1G3U654TID2QPh7Ic_OlXDmdyF8cHV3sSD2aIxrg9PIrmrcsFGYrXgk4XNo906gq8sNibRE4tbLDfHzvpYAfDHy_YLK60sm3vc6rUpJ9G4xXRNUfH2-4V6E3Q0Njzxw/s1600/The+Dash.jpg",
  "The Earthy": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhWzq4OMp2aVDFJhbD7skp4g_EAubsf6XHJpHeJ9EZ68az6CKG9ZERPbaaO5o2o-zPJK-2CYHGGbUIk2vrdI5LR-CyfcQyZ5iYID50YfKmOktS7w9BWUrR59ivUodu6k8RlTKdVU5k19BY/s1600/The+Earthy.jpg",
  "The Erase": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiegHfZr-lIRKQSHS-fWXDZPFoRq8tZs31xOav2v6EumwelnFXQuxo-dWnjoKYua9AI1ef_AkRDSWQfAjIuoCQkGMxI82084MzrytV4PI-q0Um5PlFj-L3IksMASQaXwozoQd8Vi-Xvxx0/s1600/The+Erase.jpg",
  "The Fight": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhMeyNxAf8X34WsOwl3-h5PjFi-2q-boty2lFcs5xmlH9Pl-NScSWMyNcLVpKTwdJ3S-__0aosJ5VH7_-ZOXlVUWLz7F3-q-85j5M4fjpc8GHx_EQl5NrxCkLITda3_LsXSGBGLdRcEr94/s1600/The+Fight.jpg",
  "The Fiery": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhTPKflSRsAqqQny6IMhTHlH-A9Yfx9xt_l8Wu2dDrIIT4cykTQatZhICUgPLZidnu1UyoQ6DOoVxbKbLDNGXeF_Nu9mS4vAyK0Kc6cZcRCOg98Z03v0nHmUmyGWgwyrjLeArvX7nRUo_A/s1600/The+Firey.jpg",
  "The Float": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhARZtQoOpPRfZrNSZinoyWhvOkp0DiQNx4Zma9kwQnLwJ6og64gqKEuNcf3QyoU2WvYrIQIdptp2zedqAXSPZHorYDpX1N1rL-XXKoywVvxq9DuDA7ASJ23B6d3-xhVdXuENCRQb7Cb28/s1600/The+Float.jpg",
  "The Flower": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj5fkcQ6QJrtgXhBvP_3XPhgJAlgDspVj6o_KSfL-LCgsKjKHzFKWFv2rxBx-CKGiF_x-8h-XacrWg9sB6U63J0RrwMR0a9eEZWhRSPR0SR0czkx-G40EWE6aa4We4jn1fRSL3QTtRVc38/s1600/The+Flower.jpg",
  "The Fly": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjS5MI7vH5Rr_6t_CEPY6GPLIdqTUcGIRQEKvzmuapvQgtAC9Gjf04nZWz1dcuguCWH8wgkc5WZLhxfsli6Fozqx6h4gui1njGycY2PmMwMlskUZsGjfu2TMSjPMjLF6GcB0-5FgJZDYMQ/s1600/The+Fly.jpg",
  "The Freeze": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgtLK8o8T5vFADjBw5nUrL6hLUT30yW45cbOXowtdixrHlABgAfh1wBTsUvK7D_EHhDb48FIoVumHA-44YX3o6UJpqWejSHjvO2BhfFsEmnQBfDnQl3ZgXOqlgt68iuR9CmWqzlAm8XgrI/s1600/The+Freeze.jpg",
  "The Glow": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgdjcuwiNWtwSDN1IUfaevdjPcvAkEXrTQpF09gyRSj9N5ADG2kmoJ5fF3gIfOPtKOOBKJg5LvMMzrCUt2kUXTL6jb9g7edVVPJ3W11PLTvXh8hA-HkDarnwngOBmow0nrfZYygnq5XPZA/s1600/The+Glow.jpg",
  "The Hope": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgHPsL7oryPg3baFSKLpEEjvpTuprDD3FflbjPfWQbmAhP2zQeFx2qF6LxbneJdr3bKLfgbuJsBykjpDFG79BQqLCy71ABpb6wApOUmf4XDhEMx3L94RXWfB2C1FOP-Kt4eQXkxRaEuA/s1600/The+Hope.jpg",
  "The Illusion": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEinun4S_LrYeQrtnViTTIEGxV0p7cZic0crLGg-zSlUSKecPkl9_-nkUzAkdjjG1tI3ZX0Pkhs4kUBCGT7b1TyhiY8RJaqnnzWBsLIqaohVG3tLER_TObNZ2-Cj48xRAmK_xUArYPzU9kM/s1600/The+Illusion.jpg",
  "The Jump": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgd2q0CRuYuxZJi_bHeRe-bx1aX_qiwK-thZG7g_PzpK42gu3VSNS1CCgXU7HLYlOEXBKVHKkQqLMeQ677cc68r6XcRO0EOaZkl_SNqhlowJL1vamOBCXZbzE8uT6IkTBXQsz8ceSTtJG4/s1600/The+Jump.jpg",
  "The Libra": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQIdEL5xDfPEqmbadyo8qVeIFSm3MftAIOa3ud5FXJWJget9RYnm-R4BxTGobC0j0rlGvNhg9q23Za3Xe9O8SwRSa1aplXwzbWT2KMziSdZz3smxU9AxlmBhOe-4IlmRanOwnMmQY5PJg/s1600/The+Libra.jpg",
  "The Light": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJMd2HhWdraR_OLjN4wF48wn_wGF0Ej0ShYoGCrsMBA1-JhxZSbsioxPXhM15G9qZs0hiOTg0hETptSnHD9bD62BRagOoOq-5hrJRC5l7TpjgYEC1rjhZk2-F7x5XEJg7EN6UEKb4uQyo/s1600/The+Light.jpg",
  "The Little": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhztmkGCa_OsQBRuc4uTploZlPMrrJMVc-DFqTlKItSZ5fTXpsfeiP9HRblZuepW5AKj3mYqW5jYYbp00Mafv-p-48vcTtl0AFou1ZHPNN5EDncud0XcY6-rM6Ipws5r93HSrATX4sQew0/s1600/The+Little.jpg",
  "The Lock": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjYuZkuntm-0ykYgclnl6sHgCRpv8SDmaXRu7EGq24eNIYvpkJ2EF5QuOIoXi-ACKliET1NgIpKMwhY7qBDucSjjDyloy9K-aGyZTLFYQ8xD-fgE7b74YoaWcvyZeTeRhkmMOa9ZVwAyUo/s1600/The+Lock.jpg",
  "The Loop": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgbiv9K56GhfXB8U_XqhQ_94L8RjYMbwAJms_H-W0ppjHiGLQBMyUsfQnOzLAk91MKZsLHUd33JeBdUfKWpHlIKnTRM2IzOw7OZb7La0/s1600/The+Loop.jpg",
  "The Maze": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiXWnCpOirIakG-SSkfRAQWcyq8g4OouqEnM9l5mK6ahRQfOTz5RW0sMVNU7ehRYmI3m4rMtL5wvlGjF3pMYAE0K35j5iTqU-Z1DMAnlkZo_52PPvaZKxWVa3h9PbM5UCQYEFXor9QTZvY/s1600/The+Maze.jpg",
  "The Mirror": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhKcHgmwPO4NYM4EKFgM-WDUxEfpJHqEjDjO_MB7EJ-PsOCtXX3nOWbOzcW1Y6G7eGK0yX4Vb7gAmAHVHaCC9Mmh_O55y9JLV0VEgn0hr8uuQFB48qNSsN3qFeZ-IabqbZTOFR708GxjMI/s1600/The+Mirror.jpg",
  "The Mist": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCXq0KH10D86HpvJdDgYvLyuOXY9r5Cg6pAlQmM_APIU_Ii0YPgKjxDR1fwrub7MBIltU5VFySTALloSv21SyVBxadg3wtBTiNJacoVXBe6uKh_-PyPY8jQW_eCCHB3YEqmnqfiJTzmlc/s1600/The+Mist.jpg",
  "The Move": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiBxw52t6ynura0G7RoTxrRj8L150A_XBAv0BZHkByMVa4pk1gbi8KvFwternCDI6vkT0tY3UwBkjgHzoRwNwGatxbtRtRQuebXYceBPcPZ6R_cZz1i7vjetJ9NK4ApZXYJ-S74PkbdJus/s1600/The+Move.jpg",
  "The Power": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh3_mgna87i0GhKBDbVRBGBIBmqnz_qwlN3qCA-r1RiZu6fV7cwTHaQkbiA4zNZqbCugr-twUw5EkDA7ayxRK1ec7md3fagH99aALWiNuGABZ8SycTT69qY01TfiyEORRXjaW7GQ1ihKJY/s1600/The+Power.jpg",
  "The Return": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg35KVtoVs-ZqWnHWx6bpZdXdmCqGissR66zJfHae1x9dPM1MdLg_CNKBhRioikvdy2NOu3guG_lVF1elwr-VLuaFKzurCtN589sIkVhQ0zkzHHqCYaZEi6-gxzuKV6Wq_iUQowbbJyiV8/s1600/The+Return.jpg",
  "The Sand": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjXUa-ZcF69p6qKBsF3DkhA8COIyccqAdJ2JOER4WM7cNtlDCvtLjojyCMP4yZaeHhM52pS61LIP3vBbOxfHIzao5-dacPgAInmY2MUvqiFqwNOSMqcOmOf7wOp1Hv9HofKBXNLxymGNEk/s1600/The+Sand.jpg",
  "The Shadow": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhpPu9Dhlq0scbGZK8zyrFLuzJknM0c4O3kHp74lGPl_IBm7PNHYh3AsgjG1ZI0hmclNhO_C4ojT-YYp3MZ39nvmev_pjsyzgOtkPj3A-Pv6uiBR521o6Q39ZmSzkWsmRGXkOFzKk0Y6oY/s1600/The+Shadow.jpg",
  "The Shield": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh0pbR3O9Hg6tAsmTgI-p6CzOY6ts4gqdRkjsp9mt_53M834KhHZ8XICv4eG_a1f0gKkbplgk3Tm9TP70WrO8KC1zh8OstCgePP_O4WZsGNufoUx0ZdRPN1yS1OykCGPcRAA5Z0WtLRuDo/s1600/The+Shield.jpg",
  "The Shot": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiNb9U97MPGnLsXn8f10ZrafYeXyzZu5kvvk1TKMXfvNyb5F6XuSohnohj5C8giVff6p8AXbe6kSkoLTIFJlUqemZ4Pm1gRe9B6ytn4n1oxgO-GRc-UcXFUUodUtKDyWLxO-gmSwDJeao4/s1600/The+Shot.jpg",
  "The Silent": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdFO-V3ZJz1uli-U7L8CU2-wEI7Bf5IKZFbtLvckBqK-VhdYPOaAZrFL8Uvnlwxawb3X7ExuOKS31lbeYPUBeLC-unZFT2KyQSdJAKKdjWEWNtVgTuodJA0gvp3ooE_tRLZ_xVo_k7EcI/s1600/The+Silent.jpg",
  "The Sleep": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgGpQ2BLhCDv0znPBv8Yldzt8lYDq3o0X_yP02jyG9UwR5zjgq_o2m1EemiISHD-_nSQp7zZ8Xg0-sgtnKZLkLk0Y09HvAk7j2VCscbsfVpxK3Wu8ttEYwqd1dxtio6zRL6jU6sAQqj0hE/s1600/The+Sleep.jpg",
  "The Snow": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg-JquV46NG6G4I2_L9sP8G5A_sy19ScwlsPG_z8RWyXTysSMQ26sy8vqpU0BUGcrWoWP9GI1E2tDB_TavRQgk6t4wiLDg5X6SC3x3QgDpqtWi9GBzMTBFdEmRTdrO-JR27LVX5WMXy8jM/s1600/The+Snow.jpg",
  "The Song": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjkw094MEDN6xVF4iBufcvdSi8MXPrwPov0QXBnF-24C6G7WVoPAkNSn4ULPPyArpfqSPYB3JiuxLQ2-z5OTuObXM5IjOoJzNx3rkMaNu5B4tiPiWR7pV7WoNB_731p4c_Itz83SmMETqc/s1600/The+Song.jpg",
  "The Storm": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgiw1b_-RslKXvR8jvMbYzTvAhIZYN33QFaBrTsqKF11xoK3ZzNx_Rrdl9pRSWVL5f26OYbeipw1S6Z6DLOJWhS64HqYX-kB0EeMFNT9VLCtRQMLShXqMoCfC7noW0VVplX2CCv8gQhrqY/s1600/The+Storm.jpg",
  "The Sweet": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhmX37CoFoh7acBTw0hsrYUKA7X1mmQWEXHB0pc3t1TmuNMd7K15plE9bhYp_2XtExnDcWDRc3W7q-UFNpV0dquzBnPMujejDUerg1K8jWVh-BZc3ctZ_O7vUunj4H8ZkwZ_NMQM4eei90/s1600/The+Sweet.jpg",
  "The Sword": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg4LGOAJzFrTc9IlvB4_g0dNkMzBT5mzGYYb96SbPfXkcWtfHVVhkVGmsJWQJ29ww7DCqi6-Euh239L3cBL3k_AUpqR1ce5vC-V85gS5OwAgKrUuP67QpoVSmCdH4iTBoKtVktk_0CYETU/s1600/The+Sword.jpg",
  "The Through": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhAcX-gcEIjULVkJI4-_lLrUhJ3jqJswXgdIraxVaGblWicu8HSG64o0IW7YrxpsPntkhlkUXWSC7B_kNO6UkvoZRQEM0_OSoKq450Br_s2fDVfrOmgRh09CRHqytfXNw4fiOcjJYgNS90/s1600/The+Through.jpg",
  "The Thunder": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAMCGOyMhz3G_Jpv0Qd5KYAIg3qD_oA-0Pt8e7FAghP94lajcCWzDUkMXfWk3TSMx4d23AuPfRdfgMkwsijjuyT6XEg-8E480ovd1DKZfiE-CUZmRe5bwCDljoLGMBcQdUsOcC3jEHfWE/s1600/The+Thunder.jpg",
  "The Time": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhd4qbasVwOtyRtVRdlnQ1wkh0Eu45NOOm0VLPNY1fmzf5RGHaUA9bTqbtGyCcvFWOooIctg0j-ZA-D3pVt9eYZT1_XVTTAoSjTGK2dV-qTT1MmEF0OCZE8gt0Yo-VTxWilU0ebW-Pcu4Y/s1600/The+Time.jpg",
  "The Twin": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgG-3hpq8ypZG7wuLGL-YXU41wUNr38I1Id-0jsMamnAWOcGPT1kWCtSBSRD1MM2STG1lM6XwBe7JeHm-M8AaQGlRbtaLpreAdVpGdyeStSI-Y9DOgQTHAZ_0rvumEKwKqp3B7LCIEVTIw/s1600/The+Twin.jpg",
  "The Voice": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi1GR3RR-zkaoSFQwAXC8t7lp2l24zxHlnU2XnEW_EaxaxjYluLum3IfTeuYyo1RCheTfDBJsV-6Bk5RwxMaUMRjhBSoNnGlkiFQlpd-Tqx5NSqOd_NiouHb2Fl-fxK8vDTB1ZzO_A7DcM/s1600/The+Voice.jpg",
  "The Watery": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiveEjZrK1jOPiQkOnOMBahe2NbSf2piWe29phn_NiaQvMgPYhT6WTpJ_p8tTy3chbzSNJhWVs6ab0eHbqe7bmhuTivwu1IE0ncezfKJ3ppTnk4gJz9NdZv-MCE7yLrZDCxFOm-glym6o0/s1600/The+Watery.jpg",
  "The Wave": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhqGf-0llEIQXp6F0yVJEMwxBT8dEvhYjizR4r-MQ9tzk4dnWi8Pmbi6nEXlCsoxB1aUTLQ_Lk0xOGrcLwzijH7EqDnvcPmtoL9kZCz3WOPlMRzQFjTkYXARaCUYD3F6317lfYSjP3X8lU/s1600/The+Wave.jpg",
  "The Windy": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgQZAIdqg1XDK3l_4iCIpkMrFfqaiY-e9dCWtKW3dyzigD6ompHkrzy12kIX4hoOD6WgvgUM04Su1HV2w7WeIv98C4B3C08nm4fL45QzJSpsK3u_U4R5QYdKGW9BUK1Do7p9D31QYylHqI/s1600/The+Windy.jpg",
  "The Wood": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgh2vGliCxLzK5Y5ehnRTHpVw4Zv3I04mTKBWruwW9keRvPE88gCWMxkGXxAhGYadM6qUGNVds1Y5lvgCmhdF58BUWlNWV43nJUZMi8efZjIPH2j4BW_oALLGk/s1600/The+Wood.jpg",
};

const listRow = db.query("SELECT id FROM lists WHERE name = 'Cardcaptor Sakura Cards'").get() as { id: number } | null;
if (!listRow) {
  console.error("List not found");
  process.exit(1);
}

const update = db.prepare("UPDATE items SET data = json_set(COALESCE(data, '{}'), '$.picture', ?) WHERE list_id = ? AND name = ?");

let updated = 0;
let skipped = 0;

for (const [name, url] of Object.entries(images)) {
  const result = update.run(url, listRow.id, name);
  if (result.changes > 0) {
    console.log(`✓ ${name}`);
    updated++;
  } else {
    console.log(`✗ not found: ${name}`);
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} not found`);
db.close();
